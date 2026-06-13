#!/usr/bin/env node
/* Construit data/egg.json pour l'easter egg : photos redimensionnées (≤ 2048 px)
 * puis CHIFFRÉES en AES-GCM avec une clé dérivée du mot de passe (PBKDF2-SHA256).
 * Le mot de passe n'est PAS stocké : sa justesse est prouvée par le déchiffrement.
 *
 * Usage :  EGG_PASSWORD="motdepasse" node build_egg.js photo1.jpg photo2.jpg photo3.jpg
 *
 * Seul data/egg.json (illisible sans le mot de passe) est commité ; les photos
 * d'origine restent privées et hors du dépôt.
 */
const { webcrypto } = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const subtle = webcrypto.subtle;
const PASS = (process.env.EGG_PASSWORD || '').trim().toLowerCase();
const imgs = process.argv.slice(2);
if (!PASS) { console.error('EGG_PASSWORD manquant.'); process.exit(1); }
if (!imgs.length) { console.error('Donne les chemins des images en arguments.'); process.exit(1); }

(async () => {
  const enc = new TextEncoder();
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iters = 150000;
  const baseKey = await subtle.importKey('raw', enc.encode(PASS), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' },
    baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  );
  const items = [];
  for (let i = 0; i < imgs.length; i++) {
    const tmp = path.join(os.tmpdir(), 'egg_src_' + i + '.jpg');
    execFileSync('sips', ['-Z', '2048', imgs[i], '-o', tmp], { stdio: 'ignore' });
    const bytes = fs.readFileSync(tmp);
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
    items.push({ iv: Buffer.from(iv).toString('base64'), ct: Buffer.from(ct).toString('base64'), type: 'image/jpeg' });
    try { fs.unlinkSync(tmp); } catch (e) {}
    console.error('chiffré', path.basename(imgs[i]), '→', ct.length, 'octets');
  }
  const out = { v: 1, iters, salt: Buffer.from(salt).toString('base64'), items };
  fs.writeFileSync('data/egg.json', JSON.stringify(out));
  console.error('data/egg.json écrit :', fs.statSync('data/egg.json').size, 'octets,', items.length, 'photos');
})().catch((e) => { console.error('ERREUR:', e); process.exit(1); });
