
const path = require('path');
const express = require("express");
const app = express();
const port = Number(process.env.PORT) || 8888;
app.get('/', (req, res) => {
    const imagePath = path.join(__dirname, 'index.html');
    res.sendFile(imagePath);
});
app.get('/health', (req, res) => {
    res.status(200).send('ok');
});
app.listen(port, () => {
    console.log(`🔗 HTTP keep-alive server listening on port ${port}`);
});
