# Changelog

## [0.14.0](https://github.com/confide-gg/confide/compare/confide-client-v0.13.0...confide-client-v0.14.0) (2025-12-16)


### Features

* add context menu to channel sidebar ([20e0b97](https://github.com/confide-gg/confide/commit/20e0b97c3c2de1ae3884c4b48897398605093954))
* add member role management ([1c8aa0e](https://github.com/confide-gg/confide/commit/1c8aa0e15dc80c0d4581fd65946ee7c6cf5a12d2))
* allow changing hierarchy of channels & categories ([f2e2d5e](https://github.com/confide-gg/confide/commit/f2e2d5e234fc94608418b444bc2ef5df2721e4a2))
* improve WebSocket handling and context robustness ([bfd3663](https://github.com/confide-gg/confide/commit/bfd366315cd076ad724f361f2293d3bebab71850))


### Bug Fixes

* properly show channel name in channel chat header ([56dcd21](https://github.com/confide-gg/confide/commit/56dcd21c43dc8dba67b16d59512565a041fa8dcb))

## [0.13.0](https://github.com/confide-gg/confide/compare/confide-client-v0.12.0...confide-client-v0.13.0) (2025-12-16)


### Features

* add drag-and-drop roles manager ([26fc050](https://github.com/confide-gg/confide/commit/26fc050505bee185b8c76defbd3815d9121688ef))


### Bug Fixes

* align federation role and ws behavior ([877ec13](https://github.com/confide-gg/confide/commit/877ec137a7fd219bff47e47b2b131d5561def9fe))

## [0.12.0](https://github.com/confide-gg/confide/compare/confide-client-v0.11.1...confide-client-v0.12.0) (2025-12-15)


### Features

* add snow effects for december ([45a7aed](https://github.com/confide-gg/confide/commit/45a7aeda5e7d68bec22e8de806e34b6ba168e101))
* implement pinned messages ([e86460e](https://github.com/confide-gg/confide/commit/e86460e32fada40e2564a9ef6c451daa987f7cc1))


### Bug Fixes

* improve message context menu positioning ([6a57f2d](https://github.com/confide-gg/confide/commit/6a57f2d796f1823a49efc88c084c934d6ea6653b))
* properly wire up message context menu "Edit" action ([d20c258](https://github.com/confide-gg/confide/commit/d20c2584e31e881bfddd893075779c382ca6788e))

## [0.11.1](https://github.com/confide-gg/confide/compare/confide-client-v0.11.0...confide-client-v0.11.1) (2025-12-14)


### Bug Fixes

* call events in chat now correctly show who called, declined, or cancelled ([b97a754](https://github.com/confide-gg/confide/commit/b97a754e19b45f92f221e8c7bbf18e18959a9a71))
* cancel outgoing call properly sends call_cancel to callee ([a52a739](https://github.com/confide-gg/confide/commit/a52a739b48fe6bd72984dd27196fff0d1df4dfe0))
* hangup button in minimized call overlay ([709ce55](https://github.com/confide-gg/confide/commit/709ce556acd22812914d7749630416f774c01d32))
* load theme preferences on app startup ([511ce9b](https://github.com/confide-gg/confide/commit/511ce9b7811d73c7d375e13c7c06b3c7a54a1aba))

## [0.11.0](https://github.com/confide-gg/confide/compare/confide-client-v0.10.0...confide-client-v0.11.0) (2025-12-14)


### Features

* center settings content and reduce themes to dark/light/amoled ([54cc6cf](https://github.com/confide-gg/confide/commit/54cc6cf5f360d0c92d1478cc8af1640b2c986cee))

## [0.10.0](https://github.com/confide-gg/confide/compare/confide-client-v0.9.0...confide-client-v0.10.0) (2025-12-14)


### Features

* add multi-platform release workflows for macOS, Ubuntu, and Arch ([a619817](https://github.com/confide-gg/confide/commit/a619817cf939ffccc3b2d51a0a6e412b94b40bdc))
* add Tauri auto-updater support ([c873b82](https://github.com/confide-gg/confide/commit/c873b8253c3fc2883f02c4db3a10eed720b29ac4))
* **client:** implement auto-logout on 401 unauthorized ([9b0e7dc](https://github.com/confide-gg/confide/commit/9b0e7dc1189941bdfb5a7ebc2b4f247ceb57e81e))
* implement offline overlay and connection tracking ([63ba96b](https://github.com/confide-gg/confide/commit/63ba96b5262c5d150c21bc9bb76e24bdeea197e0))
* send initial presence on user subscription and fix message field names ([79e0fcb](https://github.com/confide-gg/confide/commit/79e0fcb0968e6f4e17f42419db549a353fa3d8b3))
* show client and central version in settings footer ([8e84482](https://github.com/confide-gg/confide/commit/8e844820b62c1672984d9202b6904308654f03b0))


### Bug Fixes

* add jitter and max delay cap to WebSocket reconnection backoff ([1e32864](https://github.com/confide-gg/confide/commit/1e32864f788ed8222c8c998633364fcda999727b))
* check connection state before sending federated WS subscriptions ([caf2fdb](https://github.com/confide-gg/confide/commit/caf2fdbca1cba328adeb3668c26989b65752d755))
* **client:** debounce 401 unauthorized events to prevent logout loops ([f6338b2](https://github.com/confide-gg/confide/commit/f6338b276fe75472f0a57fa825d311861d5d824e))
* **client:** prevent websocket connection before auth ([d8da3c6](https://github.com/confide-gg/confide/commit/d8da3c65c99ff0230d2f449ec3f1f9a7174543d5))
* prevent duplicate friends and sync removals to server ([7364976](https://github.com/confide-gg/confide/commit/736497652b2fc4b1fdfe7af1aafce9199ab150a7))
* resolve initial presence sync and duplicate key crash ([eaa870c](https://github.com/confide-gg/confide/commit/eaa870c1b8bbd20ce1944c9771e7c1642c349e63))
* resubscribe to presence on WS reconnect and queue when disconnected ([c412a55](https://github.com/confide-gg/confide/commit/c412a559a2c37e98c21024c139255d8e7a9db764))
* subscribe to presence before async operations in onFriendAccepted ([c4c5069](https://github.com/confide-gg/confide/commit/c4c506946a4c63bcf6b48c5b71b398c2c0ca586a))

## [0.9.0](https://github.com/confide-gg/confide/compare/confide-client-v0.8.0...confide-client-v0.9.0) (2025-12-14)


### Features

* add multi-platform release workflows for macOS, Ubuntu, and Arch ([a619817](https://github.com/confide-gg/confide/commit/a619817cf939ffccc3b2d51a0a6e412b94b40bdc))
* add Tauri auto-updater support ([c873b82](https://github.com/confide-gg/confide/commit/c873b8253c3fc2883f02c4db3a10eed720b29ac4))
* **client:** implement auto-logout on 401 unauthorized ([9b0e7dc](https://github.com/confide-gg/confide/commit/9b0e7dc1189941bdfb5a7ebc2b4f247ceb57e81e))
* implement offline overlay and connection tracking ([63ba96b](https://github.com/confide-gg/confide/commit/63ba96b5262c5d150c21bc9bb76e24bdeea197e0))
* send initial presence on user subscription and fix message field names ([79e0fcb](https://github.com/confide-gg/confide/commit/79e0fcb0968e6f4e17f42419db549a353fa3d8b3))
* show client and central version in settings footer ([8e84482](https://github.com/confide-gg/confide/commit/8e844820b62c1672984d9202b6904308654f03b0))


### Bug Fixes

* add jitter and max delay cap to WebSocket reconnection backoff ([1e32864](https://github.com/confide-gg/confide/commit/1e32864f788ed8222c8c998633364fcda999727b))
* check connection state before sending federated WS subscriptions ([caf2fdb](https://github.com/confide-gg/confide/commit/caf2fdbca1cba328adeb3668c26989b65752d755))
* **client:** debounce 401 unauthorized events to prevent logout loops ([f6338b2](https://github.com/confide-gg/confide/commit/f6338b276fe75472f0a57fa825d311861d5d824e))
* **client:** prevent websocket connection before auth ([d8da3c6](https://github.com/confide-gg/confide/commit/d8da3c65c99ff0230d2f449ec3f1f9a7174543d5))
* prevent duplicate friends and sync removals to server ([7364976](https://github.com/confide-gg/confide/commit/736497652b2fc4b1fdfe7af1aafce9199ab150a7))
* resolve initial presence sync and duplicate key crash ([eaa870c](https://github.com/confide-gg/confide/commit/eaa870c1b8bbd20ce1944c9771e7c1642c349e63))
* resubscribe to presence on WS reconnect and queue when disconnected ([c412a55](https://github.com/confide-gg/confide/commit/c412a559a2c37e98c21024c139255d8e7a9db764))
* subscribe to presence before async operations in onFriendAccepted ([c4c5069](https://github.com/confide-gg/confide/commit/c4c506946a4c63bcf6b48c5b71b398c2c0ca586a))

## [0.8.0](https://github.com/confide-gg/confide/compare/confide-client-v0.7.0...confide-client-v0.8.0) (2025-12-14)


### Features

* add multi-platform release workflows for macOS, Ubuntu, and Arch ([a619817](https://github.com/confide-gg/confide/commit/a619817cf939ffccc3b2d51a0a6e412b94b40bdc))

## [0.7.0](https://github.com/confide-gg/confide/compare/confide-client-v0.6.0...confide-client-v0.7.0) (2025-12-14)


### Features

* add Tauri auto-updater support ([c873b82](https://github.com/confide-gg/confide/commit/c873b8253c3fc2883f02c4db3a10eed720b29ac4))

## [0.6.0](https://github.com/confide-gg/confide/compare/confide-client-v0.5.0...confide-client-v0.6.0) (2025-12-14)


### Features

* show client and central version in settings footer ([8e84482](https://github.com/confide-gg/confide/commit/8e844820b62c1672984d9202b6904308654f03b0))

## [0.5.0](https://github.com/confide-gg/confide/compare/confide-client-v0.4.1...confide-client-v0.5.0) (2025-12-14)


### Features

* send initial presence on user subscription and fix message field names ([79e0fcb](https://github.com/confide-gg/confide/commit/79e0fcb0968e6f4e17f42419db549a353fa3d8b3))

## [0.4.1](https://github.com/confide-gg/confide/compare/confide-client-v0.4.0...confide-client-v0.4.1) (2025-12-14)


### Bug Fixes

* add jitter and max delay cap to WebSocket reconnection backoff ([1e32864](https://github.com/confide-gg/confide/commit/1e32864f788ed8222c8c998633364fcda999727b))
* check connection state before sending federated WS subscriptions ([caf2fdb](https://github.com/confide-gg/confide/commit/caf2fdbca1cba328adeb3668c26989b65752d755))
* **client:** debounce 401 unauthorized events to prevent logout loops ([f6338b2](https://github.com/confide-gg/confide/commit/f6338b276fe75472f0a57fa825d311861d5d824e))
* prevent duplicate friends and sync removals to server ([7364976](https://github.com/confide-gg/confide/commit/736497652b2fc4b1fdfe7af1aafce9199ab150a7))
* resolve initial presence sync and duplicate key crash ([eaa870c](https://github.com/confide-gg/confide/commit/eaa870c1b8bbd20ce1944c9771e7c1642c349e63))
* resubscribe to presence on WS reconnect and queue when disconnected ([c412a55](https://github.com/confide-gg/confide/commit/c412a559a2c37e98c21024c139255d8e7a9db764))
* subscribe to presence before async operations in onFriendAccepted ([c4c5069](https://github.com/confide-gg/confide/commit/c4c506946a4c63bcf6b48c5b71b398c2c0ca586a))

## [0.4.0](https://github.com/confide-gg/confide/compare/confide-client-v0.3.0...confide-client-v0.4.0) (2025-12-14)


### Features

* **client:** implement auto-logout on 401 unauthorized ([9b0e7dc](https://github.com/confide-gg/confide/commit/9b0e7dc1189941bdfb5a7ebc2b4f247ceb57e81e))


### Bug Fixes

* **client:** prevent websocket connection before auth ([d8da3c6](https://github.com/confide-gg/confide/commit/d8da3c65c99ff0230d2f449ec3f1f9a7174543d5))

## [0.3.0](https://github.com/confide-gg/confide/compare/confide-client-v0.2.0...confide-client-v0.3.0) (2025-12-14)


### Features

* implement offline overlay and connection tracking ([63ba96b](https://github.com/confide-gg/confide/commit/63ba96b5262c5d150c21bc9bb76e24bdeea197e0))

## [0.2.0](https://github.com/confide-gg/confide/compare/confide-client-v0.1.0...confide-client-v0.2.0) (2025-12-14)


### Features

* implement offline overlay and connection tracking ([63ba96b](https://github.com/confide-gg/confide/commit/63ba96b5262c5d150c21bc9bb76e24bdeea197e0))
