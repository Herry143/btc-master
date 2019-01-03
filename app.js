const express = require('express');
const bodyParser = require("body-parser");
// "bitcore-lib": "^0.15.0",
const app = express();

//https
const fs = require("fs")
const https = require("https")
// const httpsServer = https.createServer({
//     key: fs.readFileSync("/root/certs/SERVER.key","utf8"),
//     cert: fs.readFileSync("/root/certs/SERVER.crt","utf8"),
//     ca: fs.readFileSync("/root/certs/ROOT.crt","utf8")
// }, app)

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const accountCtrller = require("./controller/account");
const txCtrller = require("./controller/transaction");
const blkCtrller = require("./controller/block");
const node = require("./lib/bitcore-node");

app.post("/bitcoin/account", accountCtrller.create);
app.post('/bitcoin/account/import', accountCtrller.recover);
app.post('/bitcoin/account/dump', accountCtrller.dump);
app.get('/bitcoin/account/:address/balance', accountCtrller.getBalance);
app.get('/bitcoin/account/:address/history', accountCtrller.getHistory);
app.get('/bitcoin/account/:address/history.detail', accountCtrller.getHistoryDetail);
app.post('/bitcoin/balances', accountCtrller.getBalances);
app.get('/bitcoin/account/:address/check', accountCtrller.check);


app.post("/bitcoin/transaction", txCtrller.send);
app.get('/bitcoin/transaction/sendsigned/:raw', txCtrller.sendraw);
app.get('/bitcoin/transaction/:hash/info', txCtrller.getInfo);
app.get('/bitcoin/transaction/:hash/confirmation', txCtrller.confirmation);
app.get('/bitcoin/transaction/fee', txCtrller.getFee);
app.post('/btctest/transaction', txCtrller.sendTest);
app.post('/bitcoin/transactions', txCtrller.sendMultiple);
app.post('/bitcoin/transaction/admin', txCtrller.sendAdmin);

app.get('/bitcoin/block/:block/:address?', blkCtrller.getTxs);


///////////////////////////////////////////////////////////////////////////////


/**
 * for omni layer token, there is #31(usdt)
 */

//////////////////////////////////////////////////////////////////////////////
const usdtCtrller = require("./controller/usdt");

app.post('/usdt/transaction', usdtCtrller.send);
app.get("/usdt/transaction/sendsigned/:raw", usdtCtrller.sendraw);
app.get("/usdt/transaction/:hash/confirmation", usdtCtrller.confirmation);
app.get('/usdt/transaction/fee', usdtCtrller.getFee);
app.post('/usdttest/transaction', usdtCtrller.sendTest);
app.post('/usdt/transaction/admin', usdtCtrller.sendAdmin);

/**
 * TODO  USDT查询详细历史记录
 */

node.start(() => {
    app.listen(8080);
    // httpsServer.listen(443); 
});
node.on('error', (err) => {
    console.log("error");
    console.log(err);
});

module.exports = app;