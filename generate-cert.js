// generate-cert.js
const selfsigned = require('selfsigned');
const fs = require('fs');

const attrs = [{ name: 'commonName', value: 'localhost' }];

async function generateCert() {
	const pems = await selfsigned.generate(attrs, { days: 365 });
	fs.writeFileSync('cert.pem', pems.cert);
	fs.writeFileSync('key.pem', pems.private);
	console.log('Self-signed certificate and key generated.');
}

generateCert();
