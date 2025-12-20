# Changelog

## [0.23.1](https://github.com/confide-gg/confide/compare/confide-client-v0.23.0...confide-client-v0.23.1) (2025-12-20)


### Bug Fixes

* add missing Store defaults and remove unused variable ([2cdb9ba](https://github.com/confide-gg/confide/commit/2cdb9bad4228a419774d1f22b920c4a8152b08b2))

## [0.23.0](https://github.com/confide-gg/confide/compare/confide-client-v0.22.0...confide-client-v0.23.0) (2025-12-20)


### Features

* add safe JSON parsing utility to prevent crashes ([4cb698c](https://github.com/confide-gg/confide/commit/4cb698cc2a72bdf10f0055597d69ca349dd8e307))
* add subscription manager to track and deduplicate subscriptions ([11458be](https://github.com/confide-gg/confide/commit/11458be6cecc197838f9ae0d5a4527af28811619))
* migrate private keys from localStorage to Tauri secure storage ([6ac3d7b](https://github.com/confide-gg/confide/commit/6ac3d7b4a034921db84de7c7b84ce84a8f43a703))


### Bug Fixes

* add decryption cache to prevent re-decrypting already decrypted messages ([03b3692](https://github.com/confide-gg/confide/commit/03b369209f1abb9c1072a7fa5a71d32dff4d8baf))
* add file size and type validation with secure upload IDs ([7e24ee7](https://github.com/confide-gg/confide/commit/7e24ee745ac8ce4d99b34a8a5275f8c72e398a77))
* prevent concurrent websocket connections with promise tracking ([d0cdaf2](https://github.com/confide-gg/confide/commit/d0cdaf27f6b5d8822b4e92fc86b9c3f8432b7c84))
* prevent double presence subscriptions and clear stale data on disconnect ([a0b79fb](https://github.com/confide-gg/confide/commit/a0b79fb76d5f2dbb2a75ec08532ba9adecc56b08))
* sanitize error messages in production to prevent information disclosure ([bf0fe6c](https://github.com/confide-gg/confide/commit/bf0fe6cbeaea2d466f384b71956cbc781a122ecb))
* serialize message sends with queue to prevent ratchet state corruption ([c847f20](https://github.com/confide-gg/confide/commit/c847f20f0d63f3f0ea115f95e40a26977b61dac4))
* use activeChatRef consistently to prevent race conditions in message handling ([8b415b2](https://github.com/confide-gg/confide/commit/8b415b2488dc003c90381adcdfa01e42837ff203))
* validate s3 URLs and sanitize filenames in file metadata ([d97211b](https://github.com/confide-gg/confide/commit/d97211b931e6ee84536971c1c255549932ac995c))

## [0.22.0](https://github.com/confide-gg/confide/compare/confide-client-v0.21.2...confide-client-v0.22.0) (2025-12-20)


### Features

* add clickable member profiles in groups ([4b7ae6e](https://github.com/confide-gg/confide/commit/4b7ae6e86e51751ce90439fe388e7af4d004b190))
* implement end-to-end encrypted file attachments ([4c09b59](https://github.com/confide-gg/confide/commit/4c09b59805fd77cd8d2626f70dfc47347c69ef4b))
* implement GIF picker ([1f3b9b4](https://github.com/confide-gg/confide/commit/1f3b9b4b52b0f2b8976a369ad12fa80dce32a26a))
* improve group creation and organize sidebar conversations ([0b405e0](https://github.com/confide-gg/confide/commit/0b405e0d6cc5615b3a35b0590814d528751e7dc1))


### Bug Fixes

* improve chat auto-scroll for GIFs and images ([740d1e0](https://github.com/confide-gg/confide/commit/740d1e00a04120a9318c3f878b39a4ff66a847a0))
* resolve group chat message cache and sender name issues ([4730d06](https://github.com/confide-gg/confide/commit/4730d06d9a9205b06825aead2912331fd16f452f))

## [0.21.2](https://github.com/confide-gg/confide/compare/confide-client-v0.21.1...confide-client-v0.21.2) (2025-12-18)


### Bug Fixes

* add error boundaries to context providers ([47cff75](https://github.com/confide-gg/confide/commit/47cff757dbb1e064e3f89b884bed036c9cdccc90))
* cleanup typing indicator timeouts on unmount ([4915d05](https://github.com/confide-gg/confide/commit/4915d05e95dac864af96bf769c7b589f4ad27962))

## [0.21.1](https://github.com/confide-gg/confide/compare/confide-client-v0.21.0...confide-client-v0.21.1) (2025-12-18)


### Bug Fixes

* issue where groups sometimes duplicate ([072ef8f](https://github.com/confide-gg/confide/commit/072ef8f64dc12fc539568470c635b59757a89ec0))
* separate presence channel from user events to prevent friend duplication ([45692af](https://github.com/confide-gg/confide/commit/45692af00c42457ce7f02b7b8e69524feb494672))
* show online members without roles in member list ([b24d17d](https://github.com/confide-gg/confide/commit/b24d17d615b9c27a50ad8f400243a159101d5f30))

## [0.21.0](https://github.com/confide-gg/confide/compare/confide-client-v0.20.0...confide-client-v0.21.0) (2025-12-18)


### Features

* add Spotify activity ([#32](https://github.com/confide-gg/confide/issues/32)) ([f37df12](https://github.com/confide-gg/confide/commit/f37df12fc0cdfec534baa9db0692e1bdb2601c98))

## [0.20.0](https://github.com/confide-gg/confide/compare/confide-client-v0.19.1...confide-client-v0.20.0) (2025-12-17)


### Features

* add warning when sending too many messages ([736125b](https://github.com/confide-gg/confide/commit/736125baf2f14010164da5ec02faf5c08c31a59f))
* implement React 19 optimizations ([db1d482](https://github.com/confide-gg/confide/commit/db1d4824cf73c4dab2d56b5b9ade0595a0f888d1))
* implement TanStack Query caching with instant load times ([38375ab](https://github.com/confide-gg/confide/commit/38375ab2299eadc3db9bd1756d24e6bd656bb34d))


### Bug Fixes

* dont show the Server Offline overlay on log in ([54daa33](https://github.com/confide-gg/confide/commit/54daa339ed6dade4ffe222f3fda1bacafd453012))

## [0.19.1](https://github.com/confide-gg/confide/compare/confide-client-v0.19.0...confide-client-v0.19.1) (2025-12-17)


### Bug Fixes

* restrict Tauri HTTP permissions ([2945572](https://github.com/confide-gg/confide/commit/2945572b6861ff9e832d699ea341439c10a4107d))

## [0.19.0](https://github.com/confide-gg/confide/compare/confide-client-v0.18.0...confide-client-v0.19.0) (2025-12-17)


### Features

* implement E2EE group chats ([#26](https://github.com/confide-gg/confide/issues/26)) ([0d31fde](https://github.com/confide-gg/confide/commit/0d31fde4978d10ab8958d31db5d47ff67b7fd836))

## [0.18.0](https://github.com/confide-gg/confide/compare/confide-client-v0.17.0...confide-client-v0.18.0) (2025-12-17)


### Features

* add context menu to channel sidebar ([20e0b97](https://github.com/confide-gg/confide/commit/20e0b97c3c2de1ae3884c4b48897398605093954))
* add drag-and-drop roles manager ([26fc050](https://github.com/confide-gg/confide/commit/26fc050505bee185b8c76defbd3815d9121688ef))
* add member role management ([1c8aa0e](https://github.com/confide-gg/confide/commit/1c8aa0e15dc80c0d4581fd65946ee7c6cf5a12d2))
* add multi-platform release workflows for macOS, Ubuntu, and Arch ([a619817](https://github.com/confide-gg/confide/commit/a619817cf939ffccc3b2d51a0a6e412b94b40bdc))
* add snow effects for december ([45a7aed](https://github.com/confide-gg/confide/commit/45a7aeda5e7d68bec22e8de806e34b6ba168e101))
* add Tauri auto-updater support ([c873b82](https://github.com/confide-gg/confide/commit/c873b8253c3fc2883f02c4db3a10eed720b29ac4))
* allow changing hierarchy of channels & categories ([f2e2d5e](https://github.com/confide-gg/confide/commit/f2e2d5e234fc94608418b444bc2ef5df2721e4a2))
* center settings content and reduce themes to dark/light/amoled ([54cc6cf](https://github.com/confide-gg/confide/commit/54cc6cf5f360d0c92d1478cc8af1640b2c986cee))
* **client:** implement auto-logout on 401 unauthorized ([9b0e7dc](https://github.com/confide-gg/confide/commit/9b0e7dc1189941bdfb5a7ebc2b4f247ceb57e81e))
* implement E2EE group chats ([#26](https://github.com/confide-gg/confide/issues/26)) ([0d31fde](https://github.com/confide-gg/confide/commit/0d31fde4978d10ab8958d31db5d47ff67b7fd836))
* implement offline overlay and connection tracking ([63ba96b](https://github.com/confide-gg/confide/commit/63ba96b5262c5d150c21bc9bb76e24bdeea197e0))
* implement pinned messages ([e86460e](https://github.com/confide-gg/confide/commit/e86460e32fada40e2564a9ef6c451daa987f7cc1))
* improve screen sharing with WebCodecs and H.264 chunk support ([256d532](https://github.com/confide-gg/confide/commit/256d532fd2ff6e631857edb289dc84531f36ad48))
* improve WebSocket handling and context robustness ([bfd3663](https://github.com/confide-gg/confide/commit/bfd366315cd076ad724f361f2293d3bebab71850))
* optimize imports and improve Vite build config ([c72dcd2](https://github.com/confide-gg/confide/commit/c72dcd28d808737b9e4e43b22875bc069a352e76))
* send initial presence on user subscription and fix message field names ([79e0fcb](https://github.com/confide-gg/confide/commit/79e0fcb0968e6f4e17f42419db549a353fa3d8b3))
* show client and central version in settings footer ([8e84482](https://github.com/confide-gg/confide/commit/8e844820b62c1672984d9202b6904308654f03b0))


### Bug Fixes

* add jitter and max delay cap to WebSocket reconnection backoff ([1e32864](https://github.com/confide-gg/confide/commit/1e32864f788ed8222c8c998633364fcda999727b))
* align federation role and ws behavior ([877ec13](https://github.com/confide-gg/confide/commit/877ec137a7fd219bff47e47b2b131d5561def9fe))
* call events in chat now correctly show who called, declined, or cancelled ([b97a754](https://github.com/confide-gg/confide/commit/b97a754e19b45f92f221e8c7bbf18e18959a9a71))
* cancel outgoing call properly sends call_cancel to callee ([a52a739](https://github.com/confide-gg/confide/commit/a52a739b48fe6bd72984dd27196fff0d1df4dfe0))
* check connection state before sending federated WS subscriptions ([caf2fdb](https://github.com/confide-gg/confide/commit/caf2fdbca1cba328adeb3668c26989b65752d755))
* **client:** debounce 401 unauthorized events to prevent logout loops ([f6338b2](https://github.com/confide-gg/confide/commit/f6338b276fe75472f0a57fa825d311861d5d824e))
* **client:** prevent websocket connection before auth ([d8da3c6](https://github.com/confide-gg/confide/commit/d8da3c65c99ff0230d2f449ec3f1f9a7174543d5))
* hangup button in minimized call overlay ([709ce55](https://github.com/confide-gg/confide/commit/709ce556acd22812914d7749630416f774c01d32))
* improve message context menu positioning ([6a57f2d](https://github.com/confide-gg/confide/commit/6a57f2d796f1823a49efc88c084c934d6ea6653b))
* increase Vite chunk size warning limit to 1500 ([be92e80](https://github.com/confide-gg/confide/commit/be92e80eee481cf244812a83a6da021f3440b168))
* load theme preferences on app startup ([511ce9b](https://github.com/confide-gg/confide/commit/511ce9b7811d73c7d375e13c7c06b3c7a54a1aba))
* prevent duplicate friends and sync removals to server ([7364976](https://github.com/confide-gg/confide/commit/736497652b2fc4b1fdfe7af1aafce9199ab150a7))
* properly show channel name in channel chat header ([56dcd21](https://github.com/confide-gg/confide/commit/56dcd21c43dc8dba67b16d59512565a041fa8dcb))
* properly wire up message context menu "Edit" action ([d20c258](https://github.com/confide-gg/confide/commit/d20c2584e31e881bfddd893075779c382ca6788e))
* rename username prop in FederatedMemberContextMenu ([19bc3c3](https://github.com/confide-gg/confide/commit/19bc3c31208e3ed51808c68bae7d3542ae356549))
* resolve initial presence sync and duplicate key crash ([eaa870c](https://github.com/confide-gg/confide/commit/eaa870c1b8bbd20ce1944c9771e7c1642c349e63))
* resubscribe to presence on WS reconnect and queue when disconnected ([c412a55](https://github.com/confide-gg/confide/commit/c412a559a2c37e98c21024c139255d8e7a9db764))
* subscribe to presence before async operations in onFriendAccepted ([c4c5069](https://github.com/confide-gg/confide/commit/c4c506946a4c63bcf6b48c5b71b398c2c0ca586a))
* use correct capture deps + gate macOS permissions plugin ([47a094b](https://github.com/confide-gg/confide/commit/47a094be49e8a2577f72c5ca6aecb7467f6b395c))

## [0.17.0](https://github.com/confide-gg/confide/compare/confide-client-v0.16.0...confide-client-v0.17.0) (2025-12-16)


### Features

* improve screen sharing with WebCodecs and H.264 chunk support ([256d532](https://github.com/confide-gg/confide/commit/256d532fd2ff6e631857edb289dc84531f36ad48))


### Bug Fixes

* use correct capture deps + gate macOS permissions plugin ([47a094b](https://github.com/confide-gg/confide/commit/47a094be49e8a2577f72c5ca6aecb7467f6b395c))

## [0.16.0](https://github.com/confide-gg/confide/compare/confide-client-v0.15.1...confide-client-v0.16.0) (2025-12-16)


### Features

* improve screen sharing with WebCodecs and H.264 chunk support ([256d532](https://github.com/confide-gg/confide/commit/256d532fd2ff6e631857edb289dc84531f36ad48))

## [0.15.1](https://github.com/confide-gg/confide/compare/confide-client-v0.15.0...confide-client-v0.15.1) (2025-12-16)


### Bug Fixes

* increase Vite chunk size warning limit to 1500 ([be92e80](https://github.com/confide-gg/confide/commit/be92e80eee481cf244812a83a6da021f3440b168))

## [0.15.0](https://github.com/confide-gg/confide/compare/confide-client-v0.14.0...confide-client-v0.15.0) (2025-12-16)


### Features

* optimize imports and improve Vite build config ([c72dcd2](https://github.com/confide-gg/confide/commit/c72dcd28d808737b9e4e43b22875bc069a352e76))


### Bug Fixes

* rename username prop in FederatedMemberContextMenu ([19bc3c3](https://github.com/confide-gg/confide/commit/19bc3c31208e3ed51808c68bae7d3542ae356549))

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
