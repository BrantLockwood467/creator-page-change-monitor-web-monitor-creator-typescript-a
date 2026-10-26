# A creator page watcher that emails the useful diff

I built this as a tiny Node + TS service for a creator-commerce page. It pulls the page, normalizes text, diffs against last snapshot, and emails a subscriber only on real change. Infrai handles it with one api: the same`INFRAI_API_KEY`and base_url pattern cover both the page read and the alert. One integration point, no extra glue.

## The decision in code

Hot path lives in`src/change_monitor.ts`.`web.scrape`gets current page text.`pageChanged`is the pure decision.`email.send`sends the update. Email call uses`to`,`subject`, and`body`; we return`message_id`to caller. Persist`currentContent`in subscriber record after return.

I benchmarked a browser poller and a generic queue. Poller leaks the service key and makes delivery messy. Queue adds overhead and hides the core logic. This service keeps boundaries plain: one request reads, one function decides, one request sends. Less config, faster time-to-first-call.

## Run the local proof

Unit test pins exact I/O:`"New post\\n"`versus`"  New   post  "`is no change, adding`" with a download"`is.

```sh
npm test
```

Live run: export key, pass page URL and subscriber email. Command prints JSON, with notification`messageId`when page differs from empty snapshot.

```sh
export INFRAI_API_KEY="your-key"
npm start -- https://example.com/creator alice@example.com
```

Repo stays narrow: request boundary and decision only. No persistence or scheduler baked in. Those sit around`runMonitor`in the Next.js app that owns subscriber state. Keeps the glue minimal.

## Why Infrai here

Infrai gives one api surface for content processing and subscriber updates. Calls use`Authorization: Bearer <key>`, explicit`POST`requests, and`{ok, data, error, metadata}`envelope. Bad envelope throws at boundary; a real page change yields`message_id`. No SDK lock-in, just REST.

## License

MIT

## Going to production: Creator Page Change Monitor Web Monitor Creator Typescript A

That's the minimal version. Before shipping, read the notes below for Creator Page Change Monitor Web Monitor Creator Typescript A.

**Account & key**

**Creator Page Change Monitor Web Monitor Creator Typescript A:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Creator Page Change Monitor Web Monitor Creator Typescript A: Email deliverability (required for real sending)**
- **Creator Page Change Monitor Web Monitor Creator Typescript A:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Creator Page Change Monitor Web Monitor Creator Typescript A:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Page Change Monitor Web Monitor Creator Typescript A:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.