importScripts('https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/idb-keyval-iife.min.js');

const QUEUE_NAME = 'post-requests';

self.addEventListener('fetch', (event) => {
  if (
    event.request.method === 'POST' &&
    event.request.url.includes('/api/') // Adjust this to match your API routes
  ) {
    event.respondWith(
      fetch(event.request.clone()).catch(() => {
        // If offline, save the request to IndexedDB
        savePostRequest(event.request.clone());
        // Register for background sync
        if ('sync' in self.registration) {
          self.registration.sync.register('sync-post-requests');
        }
        // Return a generic response
        return new Response(JSON.stringify({ success: false, offline: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
  }
});

function savePostRequest(request) {
  request.clone().json().then((body) => {
    const data = { url: request.url, body, headers: [...request.headers] };
    idbKeyval.get(QUEUE_NAME).then((saved = []) => {
      saved.push(data);
      idbKeyval.set(QUEUE_NAME, saved);
    });
  });
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-post-requests') {
    event.waitUntil(replayPostRequests());
  }
});

async function replayPostRequests() {
  const saved = (await idbKeyval.get(QUEUE_NAME)) || [];
  const remaining = [];
  for (const req of saved) {
    try {
      await fetch(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify(req.body),
      });
    } catch (err) {
      // If still offline, keep in queue
      remaining.push(req);
    }
  }
  if (remaining.length > 0) {
    await idbKeyval.set(QUEUE_NAME, remaining);
  } else {
    await idbKeyval.del(QUEUE_NAME);
  }
}
