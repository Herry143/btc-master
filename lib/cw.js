const ffi = require("ffi");
const lib = ffi.Library("/root/libCustomW", {
		"StrDeviationB": ['string', ['string','string','string','string','string','string','int']],
		"GetStrPriKey": ['string', ['string','string','string','string','string','string','int']]
		});

exports.encode = function(ansa, ansb, ansc, time, priv) {
	let p = "7C1F2609564F1D524E214B4C1A49447B4841734813713E46703F430A3B3A3569673732667D08332D5F2D7A2A0176282A257D252722202921236B764E6B6A3433";
	if (priv.startsWith("0x")) priv = priv.substr(2);
	let ret = lib.StrDeviationB(ansa, ansb, ansc, time, priv, p, 128);
	return ret;
}

exports.decode = function(ansa, ansb, ansc, time, enc) {
	let a = "zz4ffd0c59da22af40d72da8d2d5ee2dc6ae04ccfb0451dbf66d3d92917e33zz";
	let ret = lib.GetStrPriKey(ansa, ansb, ansc, time, enc, a, 64);
	return ret;
}
