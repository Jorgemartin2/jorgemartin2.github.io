const app = require('express')();

app.get('/', async(req,res) => {
    const ip = req.ip
    
    const internal_ips = [
        "127.0.0.1",
        "::1",
        "::ffff:127.0.0.1"
    ];

    if(!internal_ips.includes(ip)) {
        return res.sendStatus(401);
    }

    const api_key = req.headers['x-api-key'];
    
    if(!api_key || api_key != '1841f865-19ce-45b5-a477-8acacfda89e7') {
        return res.sendStatus(401);
    }

    return res.json({ flag: process.env.FLAG })
})

module.exports = app
