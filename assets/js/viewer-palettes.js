import * as THREE from './vendor/three/three.module.min.js';

// Cool to Warm (Extended), Francesca Samsel; sampled in CIELAB at 257 positions.
// Source: https://github.com/Kitware/ParaView/blob/v5.13.3/Remoting/Views/ColorMaps.json
export const SPEED_COLORS = (
  '#000059 #01025a #02045b #03065c #05085d #060a5e #070c5f #090e60 #0a1061 #0b1262 #0c1463 #0d1564 #0d1765 #0e1966 #0f1b67 #0f1c68 ' +
  '#101e69 #11206a #12226b #13246d #14276e #15296f #162b70 #162d72 #172f73 #183175 #1a3476 #1b3678 #1c3979 #1d3b7b #1e3e7d #1f407e ' +
  '#204380 #214581 #234883 #244a84 #254c85 #264f86 #275188 #285489 #29568a #2a588b #2c5a8c #2d5c8d #2e5d8e #2f5f8e #31618f #326390 ' +
  '#336591 #346792 #366993 #376b94 #386c95 #396e96 #3b7097 #3c7298 #3d7499 #3f769b #40789c #427a9e #437c9f #457fa1 #4681a3 #4883a4 ' +
  '#4985a6 #4b87a8 #4c89a9 #4e8cab #508eac #5190ae #5392b0 #5495b1 #5697b3 #5899b4 #599bb6 #5b9db7 #5d9fb9 #5ea1ba #60a3bc #61a5bd ' +
  '#63a7bf #66aac1 #68acc3 #6bafc6 #6db1c8 #70b4ca #72b7cc #75b9cf #77bcd1 #7abfd3 #7ec1d5 #81c4d7 #85c6d8 #88c9da #8bccdc #8fcede ' +
  '#92d1e0 #95d2e1 #97d4e2 #9ad5e3 #9dd7e4 #9fd8e5 #a2dae6 #a4dbe7 #a7dde8 #aadfe9 #ade0ea #b0e2eb #b4e3ec #b7e5ed #bae7ee #bde8ef ' +
  '#c0eaf0 #c2ebf1 #c5ecf2 #c7eef3 #c9eff3 #cbf0f4 #cef1f5 #d0f3f6 #d2f4f7 #d6f5f8 #daf6f8 #ddf7f9 #e1f8fa #e5f8fa #e9f9fb #ecfafb ' +
  '#f0fbfc #f3f9f5 #f5f7ee #f8f5e7 #faf3e1 #fcf1da #fcefd6 #fbedd3 #fbeacf #fbe8cc #fae6c9 #fae3c5 #f9e0c1 #f9ddbd #f8dbba #f8d8b6 ' +
  '#f7d5b2 #f6d2ae #f6ceab #f5cba7 #f5c8a4 #f4c5a0 #f3c19d #f3be99 #f2bb96 #f1b893 #f1b691 #f0b38e #f0b18c #efae89 #eeab87 #eea984 ' +
  '#eda682 #eca380 #eca17d #eb9e7b #eb9b78 #ea9876 #e99674 #e99371 #e8906f #e78d6c #e6896a #e58667 #e48364 #e37f62 #e27c5f #e1785d ' +
  '#e0755a #df7358 #de7156 #dc6e54 #db6c51 #da6a4f #d9684d #d7654b #d66349 #d46047 #d15d44 #cf5a42 #cc573f #ca543d #c7513b #c54e38 ' +
  '#c24b36 #c04835 #be4633 #bc4332 #bb4130 #b93e2f #b73b2e #b5392c #b3362b #b1342a #b03328 #ae3127 #ac2f26 #ab2d25 #a92c23 #a82a22 ' +
  '#a62821 #a42620 #a3241f #a1221e #9f201c #9e1e1b #9c1c1a #9b1a19 #991818 #971718 #961618 #941518 #921519 #911419 #8f1319 #8e1219 ' +
  '#8c1119 #8b111a #89101b #880f1c #860f1d #850e1e #830e1e #820e1f #800d20 #7e0d22 #7d0d23 #7b0d25 #7a0e26 #780e28 #760e29 #750e2b ' +
  '#730e2c #710e2d #700e2d #6e0e2e #6d0e2f #6b0e2f #690e30 #680e30 #660e31 #640f32 #630f32 #611033 #601034 #5e1134 #5c1135 #5b1235 ' +
  '#591236'
).split(' ').map(color => new THREE.Color(color));
// Turbo, Anton Mikhailov; the 256 RGB samples from the ParaView preset.
// Source: https://github.com/Kitware/ParaView/blob/v5.13.3/Remoting/Views/ColorMaps.json
export const ERROR_COLORS = (
  '#30123b #321543 #33184a #341b51 #351e58 #36215f #372466 #38276d #392a73 #3a2d79 #3b2f80 #3c3286 #3d358b #3e3891 #3f3b97 #3f3e9c ' +
  '#4040a2 #4143a7 #4146ac #4249b1 #424bb5 #434eba #4451bf #4454c3 #4456c7 #4559cb #455ccf #455ed3 #4661d6 #4664da #4666dd #4669e0 ' +
  '#466be3 #476ee6 #4771e9 #4773eb #4776ee #4778f0 #477bf2 #467df4 #4680f6 #4682f8 #4685fa #4687fb #458afc #458cfd #448ffe #4391fe ' +
  '#4294ff #4196ff #4099ff #3e9bfe #3d9efe #3ba0fd #3aa3fc #38a5fb #37a8fa #35abf8 #33adf7 #31aff5 #2fb2f4 #2eb4f2 #2cb7f0 #2ab9ee ' +
  '#28bceb #27bee9 #25c0e7 #23c3e4 #22c5e2 #20c7df #1fc9dd #1ecbda #1ccdd8 #1bd0d5 #1ad2d2 #1ad4d0 #19d5cd #18d7ca #18d9c8 #18dbc5 ' +
  '#18ddc2 #18dec0 #18e0bd #19e2bb #19e3b9 #1ae4b6 #1ce6b4 #1de7b2 #1fe9af #20eaac #22ebaa #25eca7 #27eea4 #2aefa1 #2cf09e #2ff19b ' +
  '#32f298 #35f394 #38f491 #3cf58e #3ff68a #43f787 #46f884 #4af880 #4ef97d #52fa7a #55fa76 #59fb73 #5dfc6f #61fc6c #65fd69 #69fd66 ' +
  '#6dfe62 #71fe5f #75fe5c #79fe59 #7dff56 #80ff53 #84ff51 #88ff4e #8bff4b #8fff49 #92ff47 #96fe44 #99fe42 #9cfe40 #9ffd3f #a1fd3d ' +
  '#a4fc3c #a7fc3a #a9fb39 #acfb38 #affa37 #b1f936 #b4f836 #b7f735 #b9f635 #bcf534 #bef434 #c1f334 #c3f134 #c6f034 #c8ef34 #cbed34 ' +
  '#cdec34 #d0ea34 #d2e935 #d4e735 #d7e535 #d9e436 #dbe236 #dde037 #dfdf37 #e1dd37 #e3db38 #e5d938 #e7d739 #e9d539 #ebd339 #ecd13a ' +
  '#eecf3a #efcd3a #f1cb3a #f2c93a #f4c73a #f5c53a #f6c33a #f7c13a #f8be39 #f9bc39 #faba39 #fbb838 #fbb637 #fcb336 #fcb136 #fdae35 ' +
  '#fdac34 #fea933 #fea732 #fea431 #fea130 #fe9e2f #fe9b2d #fe992c #fe962b #fe932a #fe9029 #fd8d27 #fd8a26 #fc8725 #fc8423 #fb8122 ' +
  '#fb7e21 #fa7b1f #f9781e #f9751d #f8721c #f76f1a #f66c19 #f56918 #f46617 #f36315 #f26014 #f15d13 #f05b12 #ef5811 #ed5510 #ec530f ' +
  '#eb500e #ea4e0d #e84b0c #e7490c #e5470b #e4450a #e2430a #e14109 #df3f08 #dd3d08 #dc3b07 #da3907 #d83706 #d63506 #d43305 #d23105 ' +
  '#d02f05 #ce2d04 #cc2b04 #ca2a04 #c82803 #c52603 #c32503 #c12302 #be2102 #bc2002 #b91e02 #b71d02 #b41b01 #b21a01 #af1801 #ac1701 ' +
  '#a91601 #a71401 #a41301 #a11201 #9e1001 #9b0f01 #980e01 #950d01 #920b01 #8e0a01 #8b0902 #880802 #850702 #810602 #7e0502 #7a0403'
).split(' ').map(color => new THREE.Color(color));
