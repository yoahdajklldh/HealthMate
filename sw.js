const CACHE_NAME = 'health-manager-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-72.png',
  './icon-96.png',
  './icon-128.png',
  './icon-144.png',
  './icon-152.png',
  './icon-192.png',
  './icon-384.png',
  './icon-512.png'
];

// 安装时缓存资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('缓存已打开');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.log('缓存失败:', err);
      })
  );
  self.skipWaiting();
});

// 激活时清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 拦截请求并返回缓存
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果缓存中有，直接返回
        if (response) {
          return response;
        }
        
        // 否则发起网络请求
        return fetch(event.request)
          .then(response => {
            // 检查响应是否有效
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // 克隆响应（因为响应只能使用一次）
            const responseToCache = response.clone();
            
            // 将新请求添加到缓存
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // 网络请求失败时，尝试返回离线页面
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// 后台同步（用于离线提醒）
self.addEventListener('sync', event => {
  if (event.tag === 'health-reminder') {
    event.waitUntil(
      self.registration.showNotification('健康管家', {
        body: '该进行健康活动了！',
        icon: 'icon-192.png',
        badge: 'icon-72.png',
        tag: 'health-reminder'
      })
    );
  }
});

// 推送通知
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : '该进行健康活动了！',
    icon: 'icon-192.png',
    badge: 'icon-72.png',
    tag: 'health-reminder',
    requireInteraction: true,
    actions: [
      {
        action: 'complete',
        title: '已完成'
      },
      {
        action: 'snooze',
        title: '稍后'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('健康管家', options)
  );
});

// 通知点击事件
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'complete') {
    // 用户点击已完成
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'snooze') {
    // 用户点击稍后，5分钟后再次提醒
    setTimeout(() => {
      self.registration.showNotification('健康管家', {
        body: '该进行健康活动了！',
        icon: 'icon-192.png',
        badge: 'icon-72.png',
        tag: 'health-reminder'
      });
    }, 5 * 60 * 1000);
  } else {
    // 点击通知主体，打开应用
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow('/');
      })
    );
  }
});