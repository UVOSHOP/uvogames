document.addEventListener('DOMContentLoaded', () => {
    const gameWorld = document.getElementById('game-world');
    const player = document.getElementById('player');
    const virtualAnalog = document.getElementById('virtual-analog');
    const analogStick = document.getElementById('analog-stick');

    const btnInteract = document.getElementById('btn-interact');
    const btnAction = document.getElementById('btn-action');
    const btnInventory = document.getElementById('btn-inventory');

    const moneyDisplay = document.getElementById('money-display');
    const wantedStarsDisplay = document.getElementById('wanted-stars');
    const miniMapPlayer = document.getElementById('mini-map-player');
    const missionObjectiveUI = document.getElementById('mission-objective');
    const dialogBox = document.getElementById('dialog-box');
    const dialogNpcName = document.getElementById('dialog-npc-name');
    const dialogText = document.getElementById('dialog-text');
    const inventoryBar = document.getElementById('inventory-bar');

    // --- STATE GAME ---
    let playerState = {
        x: 100, // Posisi awal X
        y: 150, // Posisi awal Y
        speed: 2,
        isMoving: false,
        isInVehicle: false,
        currentVehicle: null,
        animation: 'idle', // 'idle', 'walk'
        money: 0,
        wantedLevel: 0, // 0-5 bintang
        inventory: [{ name: 'Fist', type: 'weapon', damage: 5, icon: 'P' }],
        equippedWeapon: 0, // index di inventory
        health: 100
    };

    let npcs = [
        { id: 'npc1', el: document.getElementById('npc1'), x: 200, y: 100, dialog: "Hei kamu! Bisa bantu ambilkan paket di gang belakang?", mission: "fetch_package_gang" }
    ];

    let vehicles = [
        { id: 'car1', el: document.getElementById('car1'), x: 250, y: 200, type: 'car', smokeEl: document.querySelector('#car1 .smoke') }
    ];

    let gameMap = { // Batas map (contoh)
        width: gameWorld.offsetWidth, // Lebar game-world
        height: gameWorld.offsetHeight, // Tinggi game-world
        locations: {
            kosanTua: { x: 80, y: 130, width: 80, height: 100, name: "Kosan Tua (Spawn)" },
            kantorPolisi: { x: 350, y: 80, width: 120, height: 150, name: "Kantor Polisi" },
            tokoUmum: { x: 300, y: 250, width: 100, height: 80, name: "Toko Umum" },
            // tambahkan gang sempit, markas geng, dll.
        }
    };

    // --- FUNGSI GAME UTAMA ---

    function updatePlayerPosition() {
        // Untuk perspektif isometrik palsu, pergerakan X dan Y mungkin perlu di-adjust
        // Misal, gerakan diagonal terasa lebih natural
        // Ini bagian yang paling butuh tuning untuk 'feel' isometriknya
        // player.style.transform = `translate3d(${playerState.x}px, ${playerState.y}px, 0)`;
        player.style.left = playerState.x + 'px';
        player.style.top = playerState.y + 'px';

        // Update posisi di mini-map (perlu skala)
        const miniMapX = (playerState.x / gameMap.width) * (document.getElementById('mini-map').offsetWidth - 4); // 4 adalah ukuran mini-player
        const miniMapY = (playerState.y / gameMap.height) * (document.getElementById('mini-map').offsetHeight - 4);
        miniMapPlayer.style.left = miniMapX + 'px';
        miniMapPlayer.style.top = miniMapY + 'px';
    }

    function updateUI() {
        moneyDisplay.textContent = `Uang: $${playerState.money}`;
        let stars = '';
        for (let i = 0; i < playerState.wantedLevel; i++) {
            stars += '★'; // Karakter bintang
        }
        for (let i = playerState.wantedLevel; i < 5; i++) {
            stars += '☆'; // Karakter bintang kosong (opsional)
        }
        wantedStarsDisplay.innerHTML = stars; //Gunakan innerHTML jika pakai entitas HTML untuk bintang

        // Update tombol aksi berdasarkan konteks
        if (playerState.isInVehicle) {
            btnInteract.textContent = "TURUN";
            btnAction.style.display = 'none'; // Sembunyikan pukul/tembak saat di mobil (atau ganti fungsi)
        } else {
            btnInteract.textContent = "AMBIL/NAIK";
            btnAction.style.display = 'flex';
            const currentWeapon = playerState.inventory[playerState.equippedWeapon];
            if (currentWeapon && currentWeapon.type === 'weapon') {
                btnAction.textContent = currentWeapon.name === 'Fist' ? 'PUKUL' : 'TEMBAK';
            }
        }
    }

    function showDialog(npcName, text) {
        dialogNpcName.textContent = npcName;
        dialogText.textContent = text;
        dialogBox.style.display = 'block';
    }

    function hideDialog() {
        dialogBox.style.display = 'none';
    }

    function showMissionObjective(text) {
        missionObjectiveUI.textContent = text;
        missionObjectiveUI.style.display = 'block';
    }

    function hideMissionObjective() {
        missionObjectiveUI.style.display = 'none';
    }

    function toggleInventory() {
        inventoryBar.style.display = inventoryBar.style.display === 'none' ? 'flex' : 'none';
        if (inventoryBar.style.display === 'flex') {
            renderInventory();
        }
    }

    function renderInventory() {
        inventoryBar.innerHTML = ''; // Kosongkan dulu
        playerState.inventory.forEach((item, index) => {
            const slot = document.createElement('div');
            slot.classList.add('inventory-slot');
            slot.textContent = item.icon || item.name.substring(0, 2); // Tampilkan ikon atau 2 huruf awal
            slot.dataset.itemIndex = index;
            if (index === playerState.equippedWeapon) {
                slot.classList.add('selected');
            }
            slot.addEventListener('click', () => {
                playerState.equippedWeapon = index;
                renderInventory(); // Re-render untuk update 'selected'
                updateUI(); // Update tombol aksi
                // inventoryBar.style.display = 'none'; // Otomatis tutup setelah pilih (opsional)
            });
            inventoryBar.appendChild(slot);
        });
    }


    // --- KONTROL ANALOG ---
    let analogActive = false;
    let analogStartX = 0;
    let analogStartY = 0;
    let stickStartX = analogStick.offsetLeft;
    let stickStartY = analogStick.offsetTop;
    const analogRadius = virtualAnalog.offsetWidth / 2;
    const stickRadius = analogStick.offsetWidth / 2;

    function handleAnalogStart(e) {
        e.preventDefault();
        analogActive = true;
        const touch = e.type === 'touchstart' ? e.touches[0] : e;
        analogStartX = touch.clientX;
        analogStartY = touch.clientY;
        playerState.isMoving = true;
        // player.style.backgroundImage = "url('assets/images/player_walk.png')"; // Ganti animasi jalan
    }

    function handleAnalogMove(e) {
        if (!analogActive) return;
        e.preventDefault();
        const touch = e.type === 'touchmove' ? e.touches[0] : e;

        let deltaX = touch.clientX - analogStartX;
        let deltaY = touch.clientY - analogStartY;

        // Batasi pergerakan stick di dalam lingkaran analog
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = analogRadius - stickRadius;

        if (distance > maxDistance) {
            deltaX = (deltaX / distance) * maxDistance;
            deltaY = (deltaY / distance) * maxDistance;
        }

        analogStick.style.left = (stickStartX + deltaX) + 'px';
        analogStick.style.top = (stickStartY + deltaY) + 'px';

        // Hitung arah pergerakan player
        // Ini adalah bagian yang perlu disesuaikan dengan orientasi isometrik
        // Untuk isometrik standar (diagonal top-down):
        // Gerak kanan-bawah layar = X positif, Y positif di game world
        // Gerak kiri-atas layar = X negatif, Y negatif di game world
        let moveX = 0;
        let moveY = 0;

        // Normalisasi delta untuk kecepatan konstan
        if (distance > 0) {
            const normalizedX = deltaX / distance;
            const normalizedY = deltaY / distance;

            // Transformasi ke koordinat isometrik (ini contoh sederhana, perlu tuning)
            // Asumsi sumbu analog: atas = -Y, kanan = +X
            // Sumbu game isometrik: kanan-bawah = +X_iso, kiri-bawah = +Y_iso (atau sebaliknya, tergantung style)
            // Ini adalah bagian PALING SULIT dan butuh banyak eksperimen visual
            // Untuk "top-down diagonal" sederhana:
            // Gerak analog ke kanan -> player ke kanan-bawah
            // Gerak analog ke kiri -> player ke kiri-atas
            // Gerak analog ke atas -> player ke kiri-bawah (atau kanan-atas, tergantung axis Y map)
            // Gerak analog ke bawah -> player ke kanan-atas (atau kiri-bawah)

            // Contoh sederhana (belum isometrik):
            // moveX = normalizedX * playerState.speed;
            // moveY = normalizedY * playerState.speed;

            // Contoh dengan mapping isometrik sederhana (putar 45 derajat)
            const angle = Math.atan2(normalizedY, normalizedX);
            const isoAngle = angle - (Math.PI / 4); // Putar -45 derajat untuk mapping

            moveX = Math.cos(isoAngle) * playerState.speed;
            moveY = Math.sin(isoAngle) * playerState.speed;


            // Untuk kamera tetap top-down diagonal yang lebih umum:
            // Analog Kanan -> player X+, Y+
            // Analog Kiri -> player X-, Y-
            // Analog Atas -> player X-, Y+
            // Analog Bawah -> player X+, Y-
            // Ini mungkin yang lebih intuitif untuk gaya visual yang diminta
             //moveX = (normalizedX + normalizedY) * playerState.speed * 0.707; // 0.707 adalah 1/sqrt(2)
             //moveY = (normalizedY - normalizedX) * playerState.speed * 0.707;


            // Implementasi yang lebih mudah dipahami untuk isometrik 2.5D
            // Anggap analog atas = maju ke arah atas-layar (Y negatif di map)
            // Anggap analog kanan = maju ke arah kanan-layar (X positif di map)
            // Ini TIDAK langsung jadi isometrik, tapi kontrol dasar sumbu X dan Y.
            // Transformasi CSS yang akan membuatnya terlihat isometrik.
            // Jadi, analog X mengontrol game X, analog Y mengontrol game Y.
            if (playerState.isInVehicle && playerState.currentVehicle) {
                // Kontrol mobil: biasanya hanya maju/mundur dan belok
                // Untuk simplicitas, kita buat bisa gerak bebas dulu seperti karakter
                playerState.currentVehicle.x += normalizedX * playerState.speed * 1.5; // Mobil lebih cepat
                playerState.currentVehicle.y += normalizedY * playerState.speed * 1.5;
                playerState.x = playerState.currentVehicle.x; // Player ikut mobil
                playerState.y = playerState.currentVehicle.y;
                playerState.currentVehicle.el.style.left = playerState.currentVehicle.x + 'px';
                playerState.currentVehicle.el.style.top = playerState.currentVehicle.y + 'px';
                playerState.currentVehicle.smokeEl.style.display = 'block'; // Tampilkan asap
            } else {
                playerState.x += normalizedX * playerState.speed;
                playerState.y += normalizedY * playerState.speed;
            }


            // Batasi pergerakan di dalam map
            if (!playerState.isInVehicle) {
                playerState.x = Math.max(0, Math.min(playerState.x, gameMap.width - player.offsetWidth));
                playerState.y = Math.max(0, Math.min(playerState.y, gameMap.height - player.offsetHeight));
            } else if (playerState.currentVehicle) {
                playerState.currentVehicle.x = Math.max(0, Math.min(playerState.currentVehicle.x, gameMap.width - playerState.currentVehicle.el.offsetWidth));
                playerState.currentVehicle.y = Math.max(0, Math.min(playerState.currentVehicle.y, gameMap.height - playerState.currentVehicle.el.offsetHeight));
                playerState.x = playerState.currentVehicle.x;
                playerState.y = playerState.currentVehicle.y;
            }
        }
    }

    function handleAnalogEnd(e) {
        if (!analogActive) return;
        e.preventDefault();
        analogActive = false;
        analogStick.style.left = stickStartX + 'px';
        analogStick.style.top = stickStartY + 'px';
        playerState.isMoving = false;
        // player.style.backgroundImage = "url('assets/images/player_idle.png')"; // Ganti animasi idle
        if (playerState.isInVehicle && playerState.currentVehicle) {
            playerState.currentVehicle.smokeEl.style.display = 'none'; // Sembunyikan asap
        }
    }

    virtualAnalog.addEventListener('mousedown', handleAnalogStart);
    document.addEventListener('mousemove', handleAnalogMove);
    document.addEventListener('mouseup', handleAnalogEnd);

    virtualAnalog.addEventListener('touchstart', handleAnalogStart, { passive: false });
    document.addEventListener('touchmove', handleAnalogMove, { passive: false });
    document.addEventListener('touchend', handleAnalogEnd);
    document.addEventListener('touchcancel', handleAnalogEnd);


    // --- DETEKSI TABRAKAN SEDERHANA (AABB) ---
    function checkCollision(rect1, rect2) {
        // rect = { x, y, width, height }
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    // --- INTERAKSI ---
    btnInteract.addEventListener('click', () => {
        if (playerState.isInVehicle) { // TURUN DARI MOBIL
            playerState.isInVehicle = false;
            playerState.x = playerState.currentVehicle.x + playerState.currentVehicle.el.offsetWidth; // Muncul di samping mobil
            playerState.y = playerState.currentVehicle.y;
            player.style.display = 'block';
            playerState.currentVehicle.smokeEl.style.display = 'none';
            playerState.currentVehicle = null;
            console.log("Turun dari mobil.");
            updateUI();
            return;
        }

        // Cek interaksi dengan kendaraan
        for (let vehicle of vehicles) {
            const playerRect = { x: playerState.x, y: playerState.y, width: player.offsetWidth, height: player.offsetHeight };
            const vehicleRect = { x: vehicle.x, y: vehicle.y, width: vehicle.el.offsetWidth, height: vehicle.el.offsetHeight };
            if (checkCollision(playerRect, vehicleRect)) {
                playerState.isInVehicle = true;
                playerState.currentVehicle = vehicle;
                player.style.display = 'none'; // Sembunyikan sprite player
                console.log(`Naik ${vehicle.id}`);
                updateUI();
                return; // Hanya satu interaksi per klik
            }
        }

        // Cek interaksi dengan NPC
        for (let npc of npcs) {
            const playerRect = { x: playerState.x, y: playerState.y, width: player.offsetWidth, height: player.offsetHeight };
            // Buat area interaksi NPC sedikit lebih besar dari visualnya
            const npcInteractRect = { x: npc.x - 10, y: npc.y - 10, width: npc.el.offsetWidth + 20, height: npc.el.offsetHeight + 20 };
            if (checkCollision(playerRect, npcInteractRect)) {
                showDialog(npc.el.textContent || "Warga", npc.dialog);
                if (npc.mission) {
                    showMissionObjective("Misi Baru: " + npc.dialog); // Sederhana, bisa di-improve
                    // Logika memulai misi
                    console.log("Misi diterima:", npc.mission);
                }
                return;
            }
        }
        hideDialog(); // Jika tidak ada interaksi NPC, sembunyikan dialog

        // Cek interaksi dengan item / lokasi (placeholder)
        console.log("Tombol Ambil/Naik ditekan, tidak ada target terdekat.");
    });

    btnAction.addEventListener('click', () => {
        const currentWeapon = playerState.inventory[playerState.equippedWeapon];
        if (playerState.isInVehicle) return; // Tidak bisa aksi di mobil (untuk sekarang)

        if (currentWeapon.name === 'Fist') {
            console.log("Player memukul!");
            // Tambahkan animasi pukul
            // Cek target pukulan
            playerState.wantedLevel = Math.min(playerState.wantedLevel + 1, 5); // Naikkan wanted jika mukul sembarangan
        } else {
            console.log(`Player menembak dengan ${currentWeapon.name}!`);
            // Tambahkan animasi tembak, efek suara, proyektil
            playerState.wantedLevel = Math.min(playerState.wantedLevel + 2, 5); // Naikkan wanted
        }
        updateUI();
    });

    btnInventory.addEventListener('click', toggleInventory);

    // --- GAME LOOP ---
    function gameLoop() {
        // Proses input (sudah ditangani event listener analog)
        if (playerState.isMoving || playerState.isInVehicle) {
            updatePlayerPosition(); // Hanya update posisi jika bergerak atau di kendaraan
        }

        // Update AI (NPC, Polisi) - BELUM DIIMPLEMENTASI
        // ...

        // Render (sudah ditangani updatePlayerPosition dan CSS)
        // ...

        // Cek kondisi game lain
        // ...

        requestAnimationFrame(gameLoop);
    }


    // --- INISIALISASI ---
    function initGame() {
        // Set posisi awal player (jika tidak dari HTML style)
        // player.style.left = playerState.x + 'px';
        // player.style.top = playerState.y + 'px';
        updatePlayerPosition();
        updateUI();
        hideDialog();
        hideMissionObjective(); // Sembunyikan misi di awal
        renderInventory(); // Siapkan inventory tapi jangan tampilkan
        inventoryBar.style.display = 'none';

        // Atur transformasi isometrik awal untuk semua .iso-object (CONTOH)
        // Ini adalah bagian yang paling krusial dan kompleks untuk tampilan isometrik
        // Anda mungkin perlu mengatur transform-origin dan urutan transform yang benar
        // const isoElements = document.querySelectorAll('.iso-object');
        // isoElements.forEach(el => {
            // Contoh transform yang mungkin (perlu disesuaikan per elemen atau secara global)
            // el.style.transform = 'rotateX(45deg) rotateZ(-45deg) skewX(15deg) skewY(-15deg)';
            // el.style.transform = 'skewX(-30deg) scaleY(0.866) rotate(30deg) '; // Salah satu pendekatan pseudo iso
            // Untuk CSS transform yang benar-benar tampak 3D, butuh banyak eksperimen.
            // Yang paling umum untuk "top-down diagonal" adalah tidak menggunakan rotateX yang ekstrem,
            // tapi lebih ke scaling Y dan skew, atau menata tile secara diagonal.
            // Karena ini "Fake 3D", kita tidak benar-benar memutar kamera, tapi menggambar objek miring.
            // Sprite/gambar aset yang sudah isometrik sangat membantu.
        // });

        // Posisi awal elemen map berdasarkan data gameMap.locations (opsional, jika tidak di HTML)
        for (const locKey in gameMap.locations) {
            const loc = gameMap.locations[locKey];
            const el = document.getElementById(locKey.replace(/([A-Z])/g, '-$1').toLowerCase()); // misal kosanTua -> kosan-tua
            if (el) {
                el.style.left = loc.x + 'px';
                el.style.top = loc.y + 'px';
                el.style.width = loc.width + 'px';
                el.style.height = loc.height + 'px';
                // Tambahkan title untuk debug
                // el.title = `${loc.name} (x:${loc.x}, y:${loc.y}, w:${loc.width}, h:${loc.height})`;
            }
        }


        console.log("UVO-THE AUTO Dimulai!");
        gameLoop();
    }

    initGame();
});
