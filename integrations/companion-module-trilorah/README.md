# Trilorah — Companion module

Stream Deck control of Trilorah through [Bitfocus Companion](https://bitfocus.io/companion).

Talks to the app's paired WebSocket API (`ws://<laptop>:8081`). Nothing here is
unauthenticated: the first connection redeems a one-time 6-digit code from
**Settings → Remote** and keeps the issued token.

## Install (developer module)

```
cd integrations/companion-module-trilorah
npm install
```

Then in Companion → Settings → *Developer modules path*, point at the repo's
`integrations/` folder and restart Companion. Add the **trilorah** connection, enter
the laptop IP and the pairing code.

## Actions

Start / stop listening · approve / dismiss pending verse · next / previous verse ·
clear · black (toggle) · logo (toggle) · auto mode · show a reference · message alert
(text, seconds, target screens) · dismiss alert.

## Feedbacks & variables

Listening, pending verse, screen state (live / clear / black / logo), alert on screen;
variables `$(trilorah:pending)`, `$(trilorah:live)`, `$(trilorah:screen)`, `$(trilorah:alert)`.
