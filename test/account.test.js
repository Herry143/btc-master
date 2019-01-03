const supertest = require("supertest");
const should = require("should");

const app = require("../app");

const request = supertest(app);

describe("account.test.js", () => {
    it("GET /bitcoin/account", done => {
        request.get("/bitcoin/account").end((err, res) => {
            res.body.should.have.property("address");
            res.body.should.have.property("privateKey");
            done(err);
        })
    });

    var addr = "1Gq92RAZknsaHGsF8DCxjpC4R1FjDsUre2";
    var priv =  "2e8ee478733f89005bca1c35b19cfcc417c669c3fc008bba422f0fa46a33de68";
    it("GET /bitcoin/account/:priv", done => {
        request.get(`/bitcoin/account/getaddress/${priv}`).end((err, res) => {
            res.body.should.have.property("address");
            res.body.should.have.property("privateKey");
            res.body.address.should.equals(addr);
            res.body.privateKey.should.equals(priv);
            done(err);
        });
    });
    it("GET /bitcoin/account/:address/balance", done => {
        request.get(`/bitcoin/account/${addr}/balance`).end((err, res) => {
            res.body.should.have.property("address");
            res.body.should.have.property("balance");
            done(err);
        });
    });
    it("GET /bitcoin/account/:address/history", done => {
        request.get(`/bitcoin/account/1C1mCxRukix1KfegAY5zQQJV7samAciZpv/history`).end((err, res) => {
            res.body.should.have.property("address");
            res.body.should.have.property("transactions");
            res.body.transactions.should.be.an.Array;
            res.body.transactions.should.have.length(10);
            done(err);
        });
    });
    it("GET /bitcoin/account/:address/history?pagesize", done => {
        request.get(`/bitcoin/account/1C1mCxRukix1KfegAY5zQQJV7samAciZpv/history?pagesize=11`).end((err, res) => {
            res.body.should.have.property("address");
            res.body.should.have.property("transactions");
            res.body.transactions.should.be.an.Array;
            res.body.transactions.should.have.length(11);
            done(err);
        });
    });
    it("GET /bitcoin/account/:address/history.detail", done => {
        request.get(`/bitcoin/account/1C1mCxRukix1KfegAY5zQQJV7samAciZpv/history.detail`).end((err, res) => {
            res.body.should.have.property("address");
            res.body.should.have.property("transactions");
            res.body.transactions.should.be.an.Array;
            res.body.transactions.should.have.length(10);
            res.body.transactions[0].should.have.property("from");
            done(err);
        });
    });
    it("GET /bitcoin/account/:address/history.detail?pagesize", done => {
        request.get(`/bitcoin/account/1C1mCxRukix1KfegAY5zQQJV7samAciZpv/history.detail?pagesize=11`).end((err, res) => {
            res.body.should.have.property("address");
            res.body.should.have.property("transactions");
            res.body.transactions.should.be.an.Array;
            res.body.transactions.should.have.length(11);
            res.body.transactions[0].should.have.property("from");
            done(err);
        });
    });
})