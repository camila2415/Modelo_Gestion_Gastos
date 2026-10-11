document.addEventListener('DOMContentLoaded', () => {

    const userEmailSpan = document.getElementById('userEmail');
    const usuarioGuardado = localStorage.getItem('usuarioActivo');

    if (userEmailSpan && usuarioGuardado) {
        const usuario = JSON.parse(usuarioGuardado);
        if (usuario.email) {
            userEmailSpan.textContent = usuario.email;
        }
    }

    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', () => {
            localStorage.removeItem('usuarioActivo');
            window.location.href = 'index.html';
        });
    }

    const btnTema = document.getElementById('btnTema');
    if (btnTema) {
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
        }

        btnTema.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const esOscuro = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', esOscuro ? 'dark' : 'light');
        });
    }

    const verPasswordLogin = document.getElementById('verPasswordLogin');
    const passwordLogin = document.getElementById('password');

    if (verPasswordLogin && passwordLogin) {
        verPasswordLogin.addEventListener('click', () => {
            const esPassword = passwordLogin.type === 'password';
            passwordLogin.type = esPassword ? 'text' : 'password';
            verPasswordLogin.textContent = esPassword ? 'Ocultar contraseña' : 'Mostrar contraseña';
        });
    }

    const formLogin = document.getElementById('formLogin');
    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('email').value;
            localStorage.setItem('usuarioActivo', JSON.stringify({ email: emailInput }));
            window.location.href = 'dashboard.html';
        });
    }

    const formGasto = document.getElementById('formGasto');
    const tablaGastosBody = document.getElementById('tablaGastosBody');
    const montoTotalDiv = document.getElementById('montoTotal');
    const btnGuardarGasto = formGasto ? formGasto.querySelector('button[type="submit"]') : null;

    let listaGastos = JSON.parse(localStorage.getItem('gastosGuardados')) || [];
    let indiceEdicion = -1;

    function renderizarGastos() {
        if (!tablaGastosBody) return;

        tablaGastosBody.innerHTML = '';
        let total = 0;

        listaGastos.forEach((gasto, index) => {
            total += parseFloat(gasto.monto);

            const fila = document.createElement('tr');
            fila.innerHTML = `
                <td>$${parseFloat(gasto.monto).toFixed(2)}</td>
                <td>${gasto.categoria}</td>
                <td>${gasto.fecha}</td>
                <td>
                    <button class="btn-edit" onclick="editarGasto(${index})">Editar</button>
                    <button class="btn-delete" onclick="eliminarGasto(${index})">Eliminar</button>
                </td>
            `;
            tablaGastosBody.appendChild(fila);
        });

        if (montoTotalDiv) {
            montoTotalDiv.textContent = `$${total.toFixed(2)}`;
        }

        localStorage.setItem('gastosGuardados', JSON.stringify(listaGastos));
    }

    if (formGasto) {
        formGasto.addEventListener('submit', (e) => {
            e.preventDefault();

            const monto = document.getElementById('montoGasto').value;
            const categoria = document.getElementById('categoriaGasto').value;
            const fecha = document.getElementById('fechaGasto').value;

            if (indiceEdicion === -1) {
                listaGastos.push({ monto, categoria, fecha });
            } else {
                listaGastos[indiceEdicion] = { monto, categoria, fecha };
                indiceEdicion = -1;
                if (btnGuardarGasto) btnGuardarGasto.textContent = 'Guardar Gasto';
            }

            renderizarGastos();
            formGasto.reset();
        });

        window.editarGasto = function(index) {
            const gasto = listaGastos[index];
            document.getElementById('montoGasto').value = gasto.monto;
            document.getElementById('categoriaGasto').value = gasto.categoria;
            document.getElementById('fechaGasto').value = gasto.fecha;

            indiceEdicion = index;
            if (btnGuardarGasto) btnGuardarGasto.textContent = 'Actualizar Gasto';
        };

        window.eliminarGasto = function(index) {
            listaGastos.splice(index, 1);
            if (indiceEdicion === index) {
                indiceEdicion = -1;
                formGasto.reset();
                if (btnGuardarGasto) btnGuardarGasto.textContent = 'Guardar Gasto';
            }
            renderizarGastos();
        };

        renderizarGastos();
    }

    const verPasswordRegistro = document.getElementById('verPasswordRegistro');
    const passwordRegistro = document.getElementById('passwordRegistro');

    if (verPasswordRegistro && passwordRegistro) {
        verPasswordRegistro.addEventListener('click', () => {
            const esPassword = passwordRegistro.type === 'password';
            passwordRegistro.type = esPassword ? 'text' : 'password';
            verPasswordRegistro.textContent = esPassword ? '🙈 Ocultar contraseña' : '👁 Mostrar contraseña';
        });
    }

    const regEmail = document.getElementById('regEmail');
    const regFechaNac = document.getElementById('regFechaNac');
    const repetirPassword = document.getElementById('repetirPassword');
    const btnRegistrar = document.getElementById('btnRegistrar');

    const reqDominioMail = document.getElementById('reqDominioMail');
    const reqEdad = document.getElementById('reqEdad');
    const reqLongitud = document.getElementById('longitud');
    const reqMayuscula = document.getElementById('mayuscula');
    const reqMinuscula = document.getElementById('minuscula');
    const reqNumero = document.getElementById('numero');
    const reqEspecial = document.getElementById('especial');

    function esCorreoValido(email) {
        const correo = email.trim().toLowerCase();
        const dominiosPermitidos = ['@gmail.com', '@hotmail.com', '@outlook.com', '@yahoo.com', '@yahoo.com.ar', '@live.com'];
        const coincideDominio = dominiosPermitidos.some(dom => correo.endsWith(dom));
        const esEducativo = correo.includes('@') && (correo.endsWith('.edu') || correo.endsWith('.edu.ar') || correo.endsWith('.ar'));
        return coincideDominio || esEducativo;
    }

    function esMayorDeEdad(fechaString) {
        if (!fechaString) return false;
        const fechaNac = new Date(fechaString);
        const hoy = new Date();
        let edad = hoy.getFullYear() - fechaNac.getFullYear();
        const mes = hoy.getMonth() - fechaNac.getMonth();
        if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
            edad--;
        }
        return edad >= 18;
    }

    function validarRegistro() {
        if (!passwordRegistro) return;

        const email = regEmail ? regEmail.value : '';
        const fechaNac = regFechaNac ? regFechaNac.value : '';
        const pass = passwordRegistro.value;
        const passRepetir = repetirPassword ? repetirPassword.value : '';

        const mailValido = esCorreoValido(email);
        const esMayor = esMayorDeEdad(fechaNac);
        const tieneLongitud = pass.length >= 8;
        const tieneMayuscula = /[A-Z]/.test(pass);
        const tieneMinuscula = /[a-z]/.test(pass);
        const tieneNumero = /[0-9]/.test(pass);
        const tieneEspecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
        const coinciden = pass === passRepetir && pass !== '';

        actualizarItem(reqDominioMail, mailValido, "Dominio de correo válido (Gmail, Hotmail, Yahoo, Edu, etc.)");
        actualizarItem(reqEdad, esMayor, "Ser mayor de 18 años");
        actualizarItem(reqLongitud, tieneLongitud, "Mínimo 8 caracteres");
        actualizarItem(reqMayuscula, tieneMayuscula, "Una letra mayúscula");
        actualizarItem(reqMinuscula, tieneMinuscula, "Una letra minúscula");
        actualizarItem(reqNumero, tieneNumero, "Un número");
        actualizarItem(reqEspecial, tieneEspecial, "Un símbolo especial");

        if (btnRegistrar) {
            btnRegistrar.disabled = !(mailValido && esMayor && tieneLongitud && tieneMayuscula && tieneMinuscula && tieneNumero && tieneEspecial && coinciden);
        }
    }

    function actualizarItem(elem, valido, texto) {
        if (elem) {
            elem.textContent = valido ? `✅ ${texto}` : `❌ ${texto}`;
            elem.style.color = valido ? "#2e7d32" : "";
        }
    }

    if (passwordRegistro) {
        [regEmail, regFechaNac, passwordRegistro, repetirPassword].forEach(input => {
            if (input) {
                input.addEventListener('input', validarRegistro);
                input.addEventListener('change', validarRegistro);
            }
        });
    }
});

