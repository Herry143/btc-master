const node = require("../lib/bitcore-node");

// exports.getBalance = function (req, res) {
// var address = req.params.address;
var address = "1Ka8aikgJCG7B5QWqHCtsm9CzSQEfKfWq2";
node.services.bitcoind.getAddressBalance(address, {}, (err, balance) => {
    // if (err) {
    //     res.status(400).json({ "error": err.toString() });
    //     return;
    // }
    console.log(balance.balance.toString());
});
// }