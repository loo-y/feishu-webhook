import { Hono } from "hono";
import normal from './feishu/webhook/normal'
import {requestGroupMessage} from './feishu/webhook/normal'
// import eventDispatcher from './feishu/webhook/event'
const app = new Hono<{ Bindings: Env }>();
// import * as lark from '@larksuiteoapi/node-sdk';

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));
export default app;

app.post('/feishu/webhook/event', normal);
// 同时支持post 和  get
app.all('/feishu/group_message', requestGroupMessage);
// 增加一个中间件用来处理飞书 webhook/event
// server.on('request', lark.adaptDefault('/webhook/event', eventDispatcher, {
//     autoChallenge:true,
// }));

// app.get('/feishu', lark.adaptDefault('/webhook/event', eventDispatcher, {
//     autoChallenge:true,
// }));
