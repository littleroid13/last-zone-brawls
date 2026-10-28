# LAST ZONE BRAWLS: Tactical Classroom Royale

Game edukasi interaktif *tactical battle royale* berbasis turn-based untuk pembelajaran kelas aktif. Proyek ini telah direfaktor menjadi struktur file modular yang rapi, bersih, dan mudah dikembangkan.

---

## 📁 Struktur Proyek Modular

```text
Last Zone Brawl-Tactical Classroom Royale/
├── index.html              # Markup HTML utama, HUD, dan Modal
├── css/
│   └── style.css           # Desain Glassmorphism, animasi & styling
├── js/
│   ├── mapRenderer.js      # Engine render isometrik 3D, terrain & karakter chibi
│   └── gameEngine.js       # State game, timer real-time, turn battle & audio hooks
└── assets/
    ├── sprites/            # (Siap) Folder untuk aset gambar sprite kustom
    └── sfx/                # (Siap) Folder untuk aset efek suara (.mp3/.wav)
```

---

## 🧩 Pembagian Modul & Tanggung Jawab

| File | Tanggung Jawab Utama |
|---|---|
| [`index.html`](file:///d:/Project/Media%20Belajar/Last%20Zone%20Brawl-Tactical%20Classroom%20Royale/index.html) | Struktur UI utama: Top Bar, 4 View (Preparation, Drop Point, Combat Arena, Standings), dan 2 Modal (Question & 1v1 Challenge). |
| [`css/style.css`](file:///d:/Project/Media%20Belajar/Last%20Zone%20Brawl-Tactical%20Classroom%20Royale/css/style.css) | Gaya visual glassmorphism (`.glass-hud`, `.glass-modal`), font kustom (*Fredoka* & *Plus Jakarta Sans*), keyframe animasi glow & pop, serta scrollbar. |
| [`js/mapRenderer.js`](file:///d:/Project/Media%20Belajar/Last%20Zone%20Brawl-Tactical%20Classroom%20Royale/js/mapRenderer.js) | Transformasi koordinat tile-to-screen, rendering balok ubin isometrik 3D (rumput, air, tanah), dekorasi pohon/batu/semak, airdrop crate, avatar chibi, partikel debu, teks melayang, dan stage animasi duel 1v1. |
| [`js/gameEngine.js`](file:///d:/Project/Media%20Belajar/Last%20Zone%20Brawl-Tactical%20Classroom%20Royale/js/gameEngine.js) | Siklus permainan, timer pertandingan & penyusutan zona (Safe Zone), sistem giliran (Movement Points & Life Points), bank soal, modal interaktif, export Excel (.xlsx) & JSON, serta manajer Audio/SFX dan Sprite. |

---

## 🎨 Panduan Menambahkan Gambar Sprite Eksternal

Pada [`js/gameEngine.js`](file:///d:/Project/Media%20Belajar/Last%20Zone%20Brawl-Tactical%20Classroom%20Royale/js/gameEngine.js#L38-L47), sudah disiapkan `SpriteManager`. Anda dapat mendaftarkan gambar sprite baru:

```javascript
// Contoh mendaftarkan sprite:
SpriteManager.registerSprite('soldier', 'assets/sprites/soldier.png');
SpriteManager.registerSprite('dino', 'assets/sprites/dino.png');
```

Kemudian di [`js/mapRenderer.js`](file:///d:/Project/Media%20Belajar/Last%20Zone%20Brawl-Tactical%20Classroom%20Royale/js/mapRenderer.js), Anda dapat menggambar sprite tersebut menggunakan `ctx.drawImage()` ketika sprite sudah terisi.

---

## 🔊 Panduan Menambahkan Efek Suara (SFX)

`AudioManager` telah dipasang di [`js/gameEngine.js`](file:///d:/Project/Media%20Belajar/Last%20Zone%20Brawl-Tactical%20Classroom%20Royale/js/gameEngine.js#L14-L36) dan sudah memanggil event:
- `move` (ketika karakter melangkah)
- `click` (interaksi tombol & skip turn)
- `correct` (jawaban soal benar)
- `wrong` (jawaban soal salah)
- `airdrop` (saat peti airdrop mendarat)
- `shrink` (saat zona aman mengecil)
- `clash` (saat terjadi serangan duel 1v1)
- `victory` (saat layar pemenang muncul)

Untuk mengaktifkannya dengan audio asli, cukup daftarkan file audio ke `AudioManager.init()`:

```javascript
AudioManager.init = function() {
  this.sounds.click = new Audio('assets/sfx/click.mp3');
  this.sounds.move = new Audio('assets/sfx/step.mp3');
  this.sounds.correct = new Audio('assets/sfx/correct.mp3');
  this.sounds.wrong = new Audio('assets/sfx/wrong.mp3');
  this.sounds.airdrop = new Audio('assets/sfx/airdrop.mp3');
  this.sounds.shrink = new Audio('assets/sfx/alarm.mp3');
  this.sounds.clash = new Audio('assets/sfx/hit.mp3');
  this.sounds.victory = new Audio('assets/sfx/victory.mp3');
};
```
