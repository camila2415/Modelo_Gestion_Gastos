document.addEventListener('DOMContentLoaded', () => {

    const mostrarAlertaModal = (mensaje, titulo = "⚓ ALERTA DE AVISO") => {
        let modal = document.getElementById('modalAlertaCustom');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modalAlertaCustom';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0, 0, 0, 0.75); display: flex; align-items: center;
                justify-content: center; z-index: 9999; backdrop-filter: blur(3px);
            `;
            modal.innerHTML = `
                <div style="
                    background: #1a0f07; border: 2px solid #ff9900; border-radius: 12px;
                    padding: 24px; max-width: 400px; width: 90%; text-align: center;
                    box-shadow: 0 0 20px rgba(255, 153, 0, 0.4); color: #f0e6d2; font-family: sans-serif;
                ">
                    <h3 id="modalAlertaTitulo" style="color: #ff9900; margin-top: 0; font-size: 1.3rem;">${titulo}</h3>
                    <p id="modalAlertaTexto" style="margin: 15px 0; line-height: 1.4; color: #e0d0b0;"></p>
                    <button id="btnCerrarModalCustom" style="
                        background: linear-gradient(135deg, #ff9900, #e67e00); border: none;
                        color: #1a0f07; font-weight: bold; padding: 10px 20px; border-radius: 6px;
                        cursor: pointer; font-size: 1rem; width: 100%; margin-top: 10px;
                    ">Aceptar</button>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('btnCerrarModalCustom').addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        document.getElementById('modalAlertaTitulo').textContent = titulo;
        document.getElementById('modalAlertaTexto').textContent = mensaje;
        modal.style.display = 'flex';
    };

    let usuarioGuardado = localStorage.getItem('sgg_usuario_activo');
    if (!usuarioGuardado) {
        usuarioGuardado = 'chopper@gmail.com';
        localStorage.setItem('sgg_usuario_activo', usuarioGuardado);
    }

    const userEmailDisplay = document.getElementById('userEmailDisplay');
    if (userEmailDisplay) {
        userEmailDisplay.textContent = usuarioGuardado;
    }

    const esPaginaRegistro = window.location.pathname.includes('registro.html') || !!document.getElementById('formRegistro');
    const esPaginaRecuperar = window.location.pathname.includes('recuperar.html') || !!document.getElementById('formRecuperar');

    let intentosFallidos = 0;
    let tiempoBloqueoHasta = null;

    const formLogin = document.getElementById('formLogin') || document.querySelector('.auth-page form');

    if (formLogin && !esPaginaRegistro && !esPaginaRecuperar) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault(); 

            const ahora = Date.now();

            if (tiempoBloqueoHasta && ahora < tiempoBloqueoHasta) {
                const segundosRestantes = Math.ceil((tiempoBloqueoHasta - ahora) / 1000);
                mostrarAlertaModal(`Acceso bloqueado temporalmente por seguridad. Esperá ${segundosRestantes} segundos para reintentar.`, "🔒 BLOQUEO TEMPORAL");
                return;
            }

            const emailInput = document.getElementById('email') || document.querySelector('input[type="email"]');
            const passInput = document.getElementById('password') || document.querySelector('input[type="password"]');

            const emailVal = emailInput ? emailInput.value.trim().toLowerCase() : '';
            const passVal = passInput ? passInput.value.trim() : '';

            if (!emailVal || !passVal) {
                mostrarAlertaModal('Por favor, ingresá tu correo y contraseña.', '⚠️ CAMPOS INCOMPLETOS');
                return;
            }

            const claveGuardada = localStorage.getItem(`sgg_pass_${emailVal}`);
            let usuarioValido = false;

            if (claveGuardada) {
                usuarioValido = (passVal === claveGuardada);
            } else if (emailVal === 'chopper@gmail.com' && passVal === '123456') {
                usuarioValido = true;
            } else {
                localStorage.setItem(`sgg_pass_${emailVal}`, passVal);
                usuarioValido = true;
            }

            if (usuarioValido) {
                intentosFallidos = 0;
                tiempoBloqueoHasta = null;

                localStorage.setItem('sgg_usuario_activo', emailVal);
                window.location.href = 'dashboard.html';
            } else {
                intentosFallidos++;

                if (intentosFallidos >= 3) {
                    const TIEMPO_BLOQUEO_MS = 30000;
                    tiempoBloqueoHasta = Date.now() + TIEMPO_BLOQUEO_MS;
                    intentosFallidos = 0; 

                    mostrarAlertaModal('Superaste el límite de 3 intentos fallidos. Tu acceso fue bloqueado por 30 segundos.', '🚨 ACCESO BLOQUEADO');
                } else {
                    const restantes = 3 - intentosFallidos;
                    mostrarAlertaModal(`Credenciales incorrectas. Te quedan ${restantes} intento(s) antes del bloqueo.`, '❌ ERROR DE ACCESO');
                }
            }
        });
    }

    const formRegistro = document.getElementById('formRegistro') || (esPaginaRegistro ? document.querySelector('form') : null);

    if (formRegistro && esPaginaRegistro) {
        const emailInput = document.getElementById('email') || document.querySelector('input[type="email"]');
        const passInput = document.getElementById('password') || document.querySelectorAll('input[type="password"]')[0];
        const confirmPassInput = document.querySelectorAll('input[type="password"]')[1];

        const validarRequisitosRegistro = () => {
            const emailVal = emailInput ? emailInput.value.trim().toLowerCase() : '';
            const passVal = passInput ? passInput.value : '';

            const dominiosValidos = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'edu.ar', 'live.com'];
            const dominioEsValido = dominiosValidos.some(dom => emailVal.endsWith(`@${dom}`));
            
            const tieneMinimo8 = passVal.length >= 8;
            const tieneMayuscula = /[A-Z]/.test(passVal);
            const tieneMinuscula = /[a-z]/.test(passVal);
            const tieneNumero = /[0-9]/.test(passVal);
            const tieneSimbolo = /[^A-Za-z0-9]/.test(passVal);

            const listaItems = document.querySelectorAll('.auth-page ul li, form ul li');

            listaItems.forEach(item => {
                const texto = item.textContent;

                let cumple = false;
                if (texto.includes('Dominio de correo')) cumple = dominioEsValido;
                else if (texto.includes('Mínimo 8') || texto.includes('8 caracteres')) cumple = tieneMinimo8;
                else if (texto.includes('mayúscula')) cumple = tieneMayuscula;
                else if (texto.includes('minúscula')) cumple = tieneMinuscula;
                else if (texto.includes('número')) cumple = tieneNumero;
                else if (texto.includes('símbolo')) cumple = tieneSimbolo;
                else if (texto.includes('18 años')) cumple = true;

                if (cumple) {
                    item.style.color = '#2ecc71';
                    if (item.textContent.startsWith('• ❌') || item.textContent.startsWith('❌')) {
                        item.textContent = item.textContent.replace('❌', '✔️');
                    }
                } else {
                    item.style.color = '#e74c3c';
                    if (item.textContent.startsWith('• ✔️') || item.textContent.startsWith('✔️')) {
                        item.textContent = item.textContent.replace('✔️', '❌');
                    }
                }
            });
        };

        if (emailInput) emailInput.addEventListener('input', validarRequisitosRegistro);
        if (passInput) passInput.addEventListener('input', validarRequisitosRegistro);
        if (confirmPassInput) confirmPassInput.addEventListener('input', validarRequisitosRegistro);

        formRegistro.addEventListener('submit', (e) => {
            e.preventDefault();

            const emailVal = emailInput ? emailInput.value.trim().toLowerCase() : '';
            const passVal = passInput ? passInput.value : '';

            if (!emailVal || !passVal) {
                mostrarAlertaModal('Por favor, completá todos los campos obligatorios del registro.', '⚠️ REGISTRO INCOMPLETO');
                return;
            }

            const claveExistente = localStorage.getItem(`sgg_pass_${emailVal}`);
            const esUsuarioDefault = (emailVal === 'chopper@gmail.com');

            if (claveExistente || esUsuarioDefault) {
                mostrarAlertaModal(`El correo "${emailVal}" ya se encuentra registrado en la tripulación. Si olvidaste tu clave, seleccioná la opción de recuperar.`, '🏴‍☠️ CORREO YA REGISTRADO');
                return;
            }

            localStorage.setItem('sgg_usuario_activo', emailVal);
            localStorage.setItem(`sgg_pass_${emailVal}`, passVal);

            mostrarAlertaModal('¡Te has registrado con éxito en la tripulación! Redirigiendo al puerto...', '⚔️ REGISTRO EXITOSO');

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        });
    }

    const mostrarPromptModalCustom = (emailVal, callback) => {
        let modal = document.getElementById('modalPromptCustom');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modalPromptCustom';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0, 0, 0, 0.75); display: flex; align-items: center;
                justify-content: center; z-index: 9999; backdrop-filter: blur(3px);
            `;
            modal.innerHTML = `
                <div style="
                    background: #1a0f07; border: 2px solid #ff9900; border-radius: 12px;
                    padding: 20px; max-width: 420px; width: 90%; text-align: center;
                    box-shadow: 0 0 20px rgba(255, 153, 0, 0.4); color: #f0e6d2; font-family: sans-serif;
                ">
                    <h3 style="color: #ff9900; margin-top: 0; font-size: 1.25rem;">🕊️ VIVRE CARD RECIBIDA</h3>
                    <p style="margin: 5px 0; font-size: 0.9rem; color: #e0d0b0;">
                        Señal enviada para: <strong id="promptUserEmail" style="color: #ffcc00;"></strong>
                    </p>
                    <label style="display: block; margin-top: 10px; text-align: left; font-size: 0.85rem; color: #ff9900; font-weight: bold;">
                        Ingresá tu nueva clave del cofre:
                    </label>

                    <div style="position: relative; margin-top: 5px; margin-bottom: 10px;">
                        <input type="password" id="inputNuevaClaveCustom" placeholder="Nueva contraseña" style="
                            width: 100%; padding: 10px 40px 10px 10px;
                            background: #0d0704; border: 1px solid #ff9900; border-radius: 6px;
                            color: #ffffff; font-size: 0.95rem; box-sizing: border-box; outline: none;
                        " />
                        <button type="button" id="btnToggleClaveModal" style="
                            position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
                            background: none; border: none; color: #ff9900; cursor: pointer;
                            font-size: 1.1rem; padding: 4px;
                        " title="Mostrar/Ocultar clave">👁️</button>
                    </div>

                    <!-- Lista de Requisitos de Clave con Tildes -->
                    <ul id="listaReqModal" style="
                        text-align: left; font-size: 0.8rem; padding-left: 15px; margin: 10px 0 15px 0;
                        list-style-type: none; line-height: 1.5; color: #e74c3c;
                    ">
                        <li id="reqMin8">❌ Mínimo 8 caracteres</li>
                        <li id="reqMayus">❌ Una letra mayúscula</li>
                        <li id="reqMinus">❌ Una letra minúscula</li>
                        <li id="reqNum">❌ Un número</li>
                        <li id="reqSimbolo">❌ Un símbolo especial</li>
                    </ul>

                    <div style="display: flex; gap: 10px;">
                        <button id="btnCancelarPrompt" style="
                            flex: 1; background: #332211; border: 1px solid #664422;
                            color: #d0c0a0; font-weight: bold; padding: 10px; border-radius: 6px;
                            cursor: pointer; font-size: 0.95rem;
                        ">Cancelar</button>
                        <button id="btnGuardarPrompt" style="
                            flex: 1; background: linear-gradient(135deg, #ff9900, #e67e00); border: none;
                            color: #1a0f07; font-weight: bold; padding: 10px; border-radius: 6px;
                            cursor: pointer; font-size: 0.95rem; opacity: 0.6;
                        ">Guardar Clave</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        document.getElementById('promptUserEmail').textContent = emailVal;
        const inputClave = document.getElementById('inputNuevaClaveCustom');
        const btnToggleClave = document.getElementById('btnToggleClaveModal');
        const btnGuardar = document.getElementById('btnGuardarPrompt');

        inputClave.value = '';
        inputClave.type = 'password';
        btnToggleClave.textContent = '👁️';
        modal.style.display = 'flex';
        inputClave.focus();

        let esClaveValida = false;
        const evaluarRequisitosModal = () => {
            const val = inputClave.value;

            const min8 = val.length >= 8;
            const mayus = /[A-Z]/.test(val);
            const minus = /[a-z]/.test(val);
            const num = /[0-9]/.test(val);
            const sim = /[^A-Za-z0-9]/.test(val);

            const setReq = (elemId, cumple, texto) => {
                const el = document.getElementById(elemId);
                if (el) {
                    el.textContent = `${cumple ? '✔️' : '❌'} ${texto}`;
                    el.style.color = cumple ? '#2ecc71' : '#e74c3c';
                }
            };

            setReq('reqMin8', min8, 'Mínimo 8 caracteres');
            setReq('reqMayus', mayus, 'Una letra mayúscula');
            setReq('reqMinus', minus, 'Una letra minúscula');
            setReq('reqNum', num, 'Un número');
            setReq('reqSimbolo', sim, 'Un símbolo especial');

            esClaveValida = min8 && mayus && minus && num && sim;
            btnGuardar.style.opacity = esClaveValida ? '1' : '0.6';
        };

        evaluarRequisitosModal();
        inputClave.addEventListener('input', evaluarRequisitosModal);

        const nuevoToggle = btnToggleClave.cloneNode(true);
        btnToggleClave.parentNode.replaceChild(nuevoToggle, btnToggleClave);

        nuevoToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const esPassword = inputClave.type === 'password';
            inputClave.type = esPassword ? 'text' : 'password';
            nuevoToggle.textContent = esPassword ? '🙈' : '👁️';
        });

        const btnCancelar = document.getElementById('btnCancelarPrompt');

        const nuevoGuardar = btnGuardar.cloneNode(true);
        const nuevoCancelar = btnCancelar.cloneNode(true);
        btnGuardar.parentNode.replaceChild(nuevoGuardar, btnGuardar);
        btnCancelar.parentNode.replaceChild(nuevoCancelar, btnCancelar);

        nuevoGuardar.addEventListener('click', () => {
            const clave = inputClave.value.trim();
            if (!esClaveValida) {
                mostrarAlertaModal('La contraseña ingresada no cumple con los requisitos de seguridad requeridos.', '⚠️ REQUISITOS INCOMPLETOS');
                return;
            }
            modal.style.display = 'none';
            callback(clave);
        });

        nuevoCancelar.addEventListener('click', () => {
            modal.style.display = 'none';
            callback(null);
        });
    };

    const formRecuperar = document.getElementById('formRecuperar') || (esPaginaRecuperar ? document.querySelector('form') : null);
    if (formRecuperar && esPaginaRecuperar) {
        formRecuperar.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('email') || document.querySelector('input[type="email"]');
            const emailVal = emailInput ? emailInput.value.trim().toLowerCase() : '';

            if (!emailVal) {
                mostrarAlertaModal('Por favor, ingresá tu correo electrónico para enviar la señal de auxilio.', '⚠️ EMAIL REQUERIDO');
                return;
            }

            const claveExistente = localStorage.getItem(`sgg_pass_${emailVal}`);
            const esUsuarioDefault = (emailVal === 'chopper@gmail.com');

            if (!claveExistente && !esUsuarioDefault) {
                mostrarAlertaModal(`El correo ${emailVal} no se encuentra registrado en la tripulación. Verificá los datos o registrate primero.`, '🏴‍☠️ USUARIO NO ENCONTRADO');
                return;
            }

            mostrarPromptModalCustom(emailVal, (nuevaClave) => {
                if (!nuevaClave) {
                    mostrarAlertaModal('No se realizó ningún cambio en la clave del cofre.', '⚠️ OPERACIÓN CANCELADA');
                    return;
                }

                const claveActual = claveExistente || (esUsuarioDefault ? '123456' : '');

                if (claveActual && nuevaClave === claveActual) {
                    mostrarAlertaModal('Estás ingresando la contraseña actual. Debes escribir una clave diferente para actualizar el cofre.', '⚠️ CLAVE DUPLICADA');
                    return;
                }

                localStorage.setItem(`sgg_pass_${emailVal}`, nuevaClave);

                mostrarAlertaModal(`¡Clave restablecida con éxito para ${emailVal}! Ahora podés embarcar con tu nueva contraseña.`, '⚔️ CLAVE RESTABLECIDA');

                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            });
        });
    }

    const botonesToggle = document.querySelectorAll('.mostrar-contrasena, #btnMostrarPassword, #togglePassword, [id*="Password"], [class*="contrasena"]');

    botonesToggle.forEach(btn => {
        if (btn.tagName === 'INPUT' && btn.type === 'password') return;

        btn.addEventListener('click', (e) => {
            e.preventDefault();

            let contenedor = btn.closest('.input-group') || btn.closest('div') || btn.parentElement;
            let inputPass = contenedor ? contenedor.querySelector('input[type="password"], input[type="text"]') : null;

            if (!inputPass) {
                const formPadre = btn.closest('form') || document;
                inputPass = formPadre.querySelector('input[type="password"], input[type="text"]');
            }

            if (inputPass) {
                const esPassword = inputPass.getAttribute('type') === 'password';
                inputPass.setAttribute('type', esPassword ? 'text' : 'password');
                
                if (btn.textContent.includes('Mostrar') || btn.textContent.includes('Ocultar')) {
                    btn.textContent = esPassword ? '🙈 Ocultar contraseña' : '👁️ Mostrar contraseña';
                }
            }
        });
    });

    const aplicarTemaYModo = () => {
        const temaEstilo = localStorage.getItem('sgg_tema_estilo') || 'one-piece';
        const modoLuz = localStorage.getItem('sgg_modo_luz') || 'light';

        document.body.setAttribute('data-tema', temaEstilo);
        document.body.setAttribute('data-modo', modoLuz);

        if (temaEstilo === 'one-piece') {
            document.body.classList.add('one-piece-theme');
        } else {
            document.body.classList.remove('one-piece-theme');
        }

        if (modoLuz === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }

        const selectTema = document.getElementById('selectTemaEstilo');
        if (selectTema) selectTema.value = temaEstilo;

        window.dispatchEvent(new Event('cambioTemaModo'));
    };

    aplicarTemaYModo();

    const selectTema = document.getElementById('selectTemaEstilo');
    if (selectTema) {
        selectTema.addEventListener('change', (e) => {
            localStorage.setItem('sgg_tema_estilo', e.target.value);
            aplicarTemaYModo();
        });
    }

    const btnTema = document.getElementById('btnTemaModo') || document.getElementById('btnTema');
    if (btnTema) {
        btnTema.addEventListener('click', () => {
            const modoActual = document.body.getAttribute('data-modo') || 'light';
            const nuevoModo = modoActual === 'light' ? 'dark' : 'light';

            localStorage.setItem('sgg_modo_luz', nuevoModo);
            aplicarTemaYModo();
        });
    }

    const obtenerCotizacionDolar = async () => {
        const dolarEl = document.getElementById('dolarDisplay');
        if (!dolarEl) return;

        try {
            const respuesta = await fetch('https://dolarapi.com/v1/dolares/oficial');
            if (!respuesta.ok) throw new Error('Error HTTP al consultar API');
            
            const datos = await respuesta.json();
            dolarEl.textContent = `💵 USD Oficial: $${datos.venta}`;
        } catch (error) {
            console.error('Manejo de resiliencia API Dólar:', error);
            dolarEl.textContent = '💵 USD Oficial: N/A';
        }
    };

    obtenerCotizacionDolar();
});