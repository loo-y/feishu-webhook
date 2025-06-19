import { Hono } from "hono";
import normal from './feishu/webhook/normal'
import {requestGroupMessage, hydrationReminder } from './feishu/webhook/normal'
import { Env } from './feishu/webhook/normal'
// import eventDispatcher from './feishu/webhook/event'
const app = new Hono<{ Bindings: Env }>();
// import * as lark from '@larksuiteoapi/node-sdk';

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));
// import * as lark from '@larksuiteoapi/node-sdk';

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

app.notFound((c) => {
    // 如果是 /api/ 路径，返回 JSON 404
    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: 'Not Found' }, 404);
    }
    // 其他情况可以返回页面或静态资源
    return c.text('Not Found', 404);
});


// Only one default export, with both fetch and scheduled
export default {
    fetch: app.fetch,
    async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
        await hydrationReminder(env);
    },
};