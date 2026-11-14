 // Populate the 9 stickers on each of the 6 faces of the 3D cube
        document.querySelectorAll('.face').forEach(face => {
            for (let i = 0; i < 9; i++) {
                const sticker = document.createElement('div');
                sticker.className = 'sticker';
                face.appendChild(sticker);
            }
        });