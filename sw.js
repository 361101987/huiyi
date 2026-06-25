// 绘漪 Service Worker — v1
const CACHE_NAME = 'huiyi-v1';
const ASSETS = [
  '/',
  '/绘漪_副本.html',
  '/manifest.json'
];

// 安装：预缓存核心资源
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 预缓存资源...');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('🗑 清理旧缓存:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// 请求拦截：缓存优先，网络备用
self.addEventListener('fetch', (e) => {
  // API 请求走网络（不缓存）
  if (e.request.url.includes('/v1/api/') || e.request.url.includes('api.deepseek.com')) {
    return; // 不拦截，直接走网络
  }
  
  e.respondWith(
    caches.match(e.request).then((cached) => {
      // 命中缓存直接返回
      if (cached) return cached;
      
      // 否则请求网络
      return fetch(e.request).then((resp) => {
        // 只缓存成功响应
        if (!resp || resp.status !== 200) return resp;
        
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, clone);
        });
        return resp;
      });
    }).catch(() => {
      // 离线时返回友好页面（仅 HTML 请求）
      if (e.request.headers.get('accept')?.includes('text/html')) {
        return caches.match('/');
      }
    })
  );
});
