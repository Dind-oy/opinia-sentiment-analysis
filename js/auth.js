// ============================================================
// auth.js
// Daftar, login berbasis PHP session, dan sinkronisasi akun.
// ============================================================

function togglePassword(fieldId) {
  const field = document.getElementById(fieldId);

  if (!field) {
    return;
  }

  field.type =
    field.type === 'password'
      ? 'text'
      : 'password';
}


const registerForm =
  document.getElementById('registerForm');

if (registerForm) {
  registerForm.addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      const nama =
        document
          .getElementById('namaLengkap')
          .value
          .trim();

      const username =
        document
          .getElementById('usernameReg')
          .value
          .trim();

      const password =
        document
          .getElementById('passwordReg')
          .value;

      const konfirmasi =
        document
          .getElementById('passwordConfirm')
          .value;

      if (password !== konfirmasi) {
        alert(
          'Password tidak cocok. Silakan cek kembali.'
        );

        return;
      }

      if (password.length < 4) {
        alert('Password minimal 4 karakter.');
        return;
      }

      try {
        const response = await fetch(
          'backend/daftar.php',
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              nama,
              username,
              password,
              konfirmasi_password: konfirmasi
            })
          }
        );

        const data = await readJsonResponse(response);

        if (!response.ok || data.status !== 'success') {
          throw new Error(
            data.pesan || 'Pendaftaran gagal.'
          );
        }

        alert(
          'Pendaftaran berhasil! Silakan login.'
        );

        window.location.href = 'login.html';

      } catch (error) {
        console.error(error);
        alert(error.message);
      }
    }
  );
}


const loginForm =
  document.getElementById('loginForm');

if (loginForm) {
  loginForm.addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      const username =
        document
          .getElementById('username')
          .value
          .trim();

      const password =
        document
          .getElementById('password')
          .value;

      try {
        const response = await fetch(
          'backend/login.php',
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              username,
              password
            })
          }
        );

        const data = await readJsonResponse(response);

        if (!response.ok || data.status !== 'success') {
          throw new Error(
            data.pesan ||
            'Username atau password salah.'
          );
        }

        const previousUserId =
          localStorage.getItem('user_id');

        if (
          previousUserId &&
          String(previousUserId) !==
            String(data.user.id)
        ) {
          localStorage.removeItem(
            `lastUpload_${previousUserId}`
          );

          localStorage.removeItem(
            `appNotifications_${previousUserId}`
          );
        }

        /*
         * Hapus key lama yang dulu dipakai bersama semua akun.
         * Inilah salah satu biang data antarakun tercampur.
         */
        localStorage.removeItem('lastUpload');
        localStorage.removeItem('appNotifications');

        localStorage.setItem(
          'user_id',
          String(data.user.id)
        );

        localStorage.setItem(
          'username',
          data.user.username
        );

        localStorage.setItem(
          'nama',
          data.user.nama
        );

        const nextPage =
          new URLSearchParams(
            window.location.search
          ).get('next');

        window.location.replace(
          nextPage || 'dashboard.html'
        );

      } catch (error) {
        console.error(error);
        alert(error.message);
      }
    }
  );
}


async function readJsonResponse(response) {
  const contentType =
    response.headers.get('content-type') || '';

  const rawText = await response.text();

  if (!contentType.includes('application/json')) {
    console.error(
      'Server mengembalikan bukan JSON:',
      rawText
    );

    throw new Error(
      'Server tidak memberikan respons JSON.'
    );
  }

  return JSON.parse(rawText);
}

// Halaman login dan daftar sengaja tetap bisa dibuka walaupun sesi lain masih aktif.
