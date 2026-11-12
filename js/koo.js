document.addEventListener('DOMContentLoaded', () => {

    // Helper para detectar el tema y modo actuales
    const obtenerConfigTema = () => {
        const esOnePiece = (localStorage.getItem('sgg_tema_estilo') || 'one-piece') === 'one-piece';
        const esDark = (localStorage.getItem('sgg_modo_luz') || 'light') === 'dark';
        return { esOnePiece, esDark };
    };

    // Helper para devolver texto según el tema activo
    const textoTema = (textoNormal, textoOnePiece) => {
        return obtenerConfigTema().esOnePiece ? textoOnePiece : textoNormal;
    };

    const mostrarAlertaModal = (mensaje, titulo = null) => {
        const { esOnePiece, esDark } = obtenerConfigTema();
        const tituloFinal = titulo || (esOnePiece ? "⚓ ALERTA DE AVISO" : "⚠️ Aviso del Sistema");

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
                <div id="modalAlertaCaja" style="
                    border-radius: 12px; padding: 24px; max-width: 400px; width: 90%;
                    text-align: center; font-family: sans-serif; transition: all 0.2s ease;
                ">
                    <h3 id="modalAlertaTitulo" style="margin-top: 0; font-size: 1.3rem;"></h3>
                    <p id="modalAlertaTexto" style="margin: 15px 0; line-height: 1.4;"></p>
                    <button id="btnCerrarModalCustom" style="
                        border: none; font-weight: bold; padding: 10px 20px; border-radius: 6px;
                        cursor: pointer; font-size: 1rem; width: 100%; margin-top: 10px;
                    ">Aceptar</button>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('btnCerrarModalCustom').addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Aplicar colores dinámicos según Tema y Modo
        const caja = document.getElementById('modalAlertaCaja');
        const tituloEl = document.getElementById('modalAlertaTitulo');
        const textoEl = document.getElementById('modalAlertaTexto');
        const btnCerrar = document.getElementById('btnCerrarModalCustom');

        if (esOnePiece) {
            caja.style.background = '#1a0f07';
            caja.style.border = '2px solid #ff9900';
            caja.style.boxShadow = '0 0 20px rgba(255, 153, 0, 0.4)';
            tituloEl.style.color = '#ff9900';
            textoEl.style.color = '#e0d0b0';
            btnCerrar.style.background = 'linear-gradient(135deg, #ff9900, #e67e00)';
            btnCerrar.style.color = '#1a0f07';
        } else if (esDark) {
            caja.style.background = '#1e293b';
            caja.style.border = '2px solid #3b82f6';
            caja.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.35)';
            tituloEl.style.color = '#60a5fa';
            textoEl.style.color = '#f1f5f9';
            btnCerrar.style.background = '#3b82f6';
            btnCerrar.style.color = '#ffffff';
        } else {
            caja.style.background = '#ffffff';
            caja.style.border = '2px solid #2563eb';
            caja.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)';
            tituloEl.style.color = '#1d4ed8';
            textoEl.style.color = '#334155';
            btnCerrar.style.background = '#2563eb';
            btnCerrar.style.color = '#ffffff';
        }

        tituloEl.textContent = tituloFinal;
        textoEl.textContent = mensaje;
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

    // LOGICA DE INICIO DE SESIÓN (LOGIN)
    if (formLogin && !esPaginaRegistro && !esPaginaRecuperar) {
        formLogin.addEventListener('submit', async (e) => {
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

            if (window.AppDB) await window.AppDB.initDB();

            let usuarioValido = false;

            if (window.AppDB && window.AppDB.db) {
                const res = window.AppDB.query(`SELECT * FROM usuarios WHERE email = ? OR username = ?`, [emailVal, emailVal]);
                if (res.length > 0 && res[0].password_hash === passVal) {
                    usuarioValido = true;
                }
            }
            if (!usuarioValido) {
                const claveGuardada = localStorage.getItem(`sgg_pass_${emailVal}`);
                if (claveGuardada && passVal === claveGuardada) {
                    usuarioValido = true;
                } else if (emailVal === 'chopper@gmail.com' && passVal === 'Hola1234@') {
                    usuarioValido = true;
                }
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

            const emailInput = document.getElementById('regEmail');
            const passInput = document.getElementById('passwordRegistro');
            const confirmPassInput = document.getElementById('repetirPassword');

            const emailVal = emailInput ? emailInput.value.trim().toLowerCase() : '';
            const passVal = passInput ? passInput.value : '';
            const confirmPassVal = confirmPassInput ? confirmPassInput.value : '';

            if (!emailVal || !passVal) {
                mostrarAlertaModal('Por favor, completá todos los campos obligatorios del registro.', '⚠️ REGISTRO INCOMPLETO');
                return;
            }
            if (passVal !== confirmPassVal) {
                mostrarAlertaModal(
                    textoTema(
                        'Las contraseñas no coinciden. Verificalas e intentá de nuevo.',
                        'Las claves del cofre no coinciden. Verificalas e intentá de nuevo.'
                    ),
                    textoTema('⚠️ CONTRASEÑAS NO COINCIDEN', '⚠️ CLAVES NO COINCIDEN')
                );
                return;
            }

            const claveExistente = localStorage.getItem(`sgg_pass_${emailVal}`);
            const esUsuarioDefault = (emailVal === 'chopper@gmail.com');

            if (claveExistente || esUsuarioDefault) {
                mostrarAlertaModal(
                    textoTema(
                        `El correo "${emailVal}" ya se encuentra registrado en el sistema. Si olvidaste tu contraseña, seleccioná la opción de recuperar.`,
                        `El correo "${emailVal}" ya se encuentra registrado en la tripulación. Si olvidaste tu clave, seleccioná la opción de recuperar.`
                    ),
                    textoTema('⚠️ CORREO YA REGISTRADO', '🏴‍☠️ CORREO YA REGISTRADO')
                );
                return;
            }

            localStorage.setItem('sgg_usuario_activo', emailVal);
            localStorage.setItem(`sgg_pass_${emailVal}`, passVal);

            mostrarAlertaModal(
                textoTema(
                    '¡Te has registrado con éxito en el sistema! Redirigiendo al panel...',
                    '¡Te has registrado con éxito en la tripulación! Redirigiendo al puerto...'
                ),
                textoTema('✅ REGISTRO EXITOSO', '⚔️ REGISTRO EXITOSO')
            );

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        });
    }

    const mostrarPromptModalCustom = (emailVal, callback) => {
        const { esOnePiece, esDark } = obtenerConfigTema();

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
                <div id="modalPromptCaja" style="
                    border-radius: 12px; padding: 20px; max-width: 420px; width: 90%;
                    text-align: center; font-family: sans-serif; transition: all 0.2s ease;
                ">
                    <h3 id="promptTitulo" style="margin-top: 0; font-size: 1.25rem;"></h3>
                    <p id="promptSubtitulo" style="margin: 5px 0; font-size: 0.9rem;">
                        <span id="promptSubtituloTexto"></span> <strong id="promptUserEmail"></strong>
                    </p>
                    <label id="promptLabel" style="display: block; margin-top: 10px; text-align: left; font-size: 0.85rem; font-weight: bold;"></label>

                    <div style="position: relative; margin-top: 5px; margin-bottom: 10px;">
                        <input type="password" id="inputNuevaClaveCustom" placeholder="Nueva contraseña" style="
                            width: 100%; padding: 10px 40px 10px 10px; border-radius: 6px;
                            font-size: 0.95rem; box-sizing: border-box; outline: none;
                        " />
                        <button type="button" id="btnToggleClaveModal" style="
                            position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
                            background: none; border: none; cursor: pointer;
                            font-size: 1.1rem; padding: 4px;
                        " title="Mostrar/Ocultar clave">👁️</button>
                    </div>
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
                            flex: 1; font-weight: bold; padding: 10px; border-radius: 6px;
                            cursor: pointer; font-size: 0.95rem;
                        ">Cancelar</button>
                        <button id="btnGuardarPrompt" style="
                            flex: 1; border: none; font-weight: bold; padding: 10px; border-radius: 6px;
                            cursor: pointer; font-size: 0.95rem; opacity: 0.6;
                        ">Guardar Clave</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        // Aplicar textos y colores según el tema activo
        const caja = document.getElementById('modalPromptCaja');
        const tituloEl = document.getElementById('promptTitulo');
        const subtituloEl = document.getElementById('promptSubtitulo');
        const subtituloTextoEl = document.getElementById('promptSubtituloTexto');
        const emailEl = document.getElementById('promptUserEmail');
        const labelEl = document.getElementById('promptLabel');
        const inputClave = document.getElementById('inputNuevaClaveCustom');
        const btnToggleClave = document.getElementById('btnToggleClaveModal');
        const btnCancelar = document.getElementById('btnCancelarPrompt');
        const btnGuardar = document.getElementById('btnGuardarPrompt');

        tituloEl.textContent = esOnePiece ? '🕊️ VIVRE CARD RECIBIDA' : '🔑 RESTABLECER CONTRASEÑA';
        subtituloTextoEl.textContent = esOnePiece ? 'Señal enviada para:' : 'Recuperación solicitada para:';
        labelEl.textContent = esOnePiece ? 'Ingresá tu nueva clave del cofre:' : 'Ingresá tu nueva contraseña:';
        btnGuardar.textContent = esOnePiece ? 'Guardar Clave' : 'Guardar Contraseña';

        if (esOnePiece) {
            caja.style.background = '#1a0f07';
            caja.style.border = '2px solid #ff9900';
            caja.style.boxShadow = '0 0 20px rgba(255, 153, 0, 0.4)';
            tituloEl.style.color = '#ff9900';
            subtituloEl.style.color = '#e0d0b0';
            emailEl.style.color = '#ffcc00';
            labelEl.style.color = '#ff9900';
            inputClave.style.background = '#0d0704';
            inputClave.style.border = '1px solid #ff9900';
            inputClave.style.color = '#ffffff';
            btnToggleClave.style.color = '#ff9900';
            btnCancelar.style.background = '#332211';
            btnCancelar.style.border = '1px solid #664422';
            btnCancelar.style.color = '#d0c0a0';
            btnGuardar.style.background = 'linear-gradient(135deg, #ff9900, #e67e00)';
            btnGuardar.style.color = '#1a0f07';
        } else if (esDark) {
            caja.style.background = '#1e293b';
            caja.style.border = '2px solid #3b82f6';
            caja.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.35)';
            tituloEl.style.color = '#60a5fa';
            subtituloEl.style.color = '#cbd5e1';
            emailEl.style.color = '#93c5fd';
            labelEl.style.color = '#60a5fa';
            inputClave.style.background = '#0f172a';
            inputClave.style.border = '1px solid #3b82f6';
            inputClave.style.color = '#ffffff';
            btnToggleClave.style.color = '#60a5fa';
            btnCancelar.style.background = '#334155';
            btnCancelar.style.border = '1px solid #475569';
            btnCancelar.style.color = '#e2e8f0';
            btnGuardar.style.background = '#3b82f6';
            btnGuardar.style.color = '#ffffff';
        } else {
            caja.style.background = '#ffffff';
            caja.style.border = '2px solid #2563eb';
            caja.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)';
            tituloEl.style.color = '#1d4ed8';
            subtituloEl.style.color = '#475569';
            emailEl.style.color = '#1e40af';
            labelEl.style.color = '#1d4ed8';
            inputClave.style.background = '#f8fafc';
            inputClave.style.border = '1px solid #94a3b8';
            inputClave.style.color = '#0f172a';
            btnToggleClave.style.color = '#2563eb';
            btnCancelar.style.background = '#e2e8f0';
            btnCancelar.style.border = '1px solid #cbd5e1';
            btnCancelar.style.color = '#334155';
            btnGuardar.style.background = '#2563eb';
            btnGuardar.style.color = '#ffffff';
        }

        emailEl.textContent = emailVal;
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
        inputClave.oninput = evaluarRequisitosModal;

        const nuevoToggle = btnToggleClave.cloneNode(true);
        btnToggleClave.parentNode.replaceChild(nuevoToggle, btnToggleClave);

        nuevoToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const esPassword = inputClave.type === 'password';
            inputClave.type = esPassword ? 'text' : 'password';
            nuevoToggle.textContent = esPassword ? '🙈' : '👁️';
        });

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
                mostrarAlertaModal(
                    textoTema(
                        'Por favor, ingresá tu correo electrónico para recuperar tu contraseña.',
                        'Por favor, ingresá tu correo electrónico para enviar la señal de auxilio.'
                    ),
                    '⚠️ EMAIL REQUERIDO'
                );
                return;
            }

            const claveExistente = localStorage.getItem(`sgg_pass_${emailVal}`);
            const esUsuarioDefault = (emailVal === 'chopper@gmail.com');

            if (!claveExistente && !esUsuarioDefault) {
                mostrarAlertaModal(
                    textoTema(
                        `El correo ${emailVal} no se encuentra registrado en el sistema. Verificá los datos o registrate primero.`,
                        `El correo ${emailVal} no se encuentra registrado en la tripulación. Verificá los datos o registrate primero.`
                    ),
                    textoTema('⚠️ USUARIO NO ENCONTRADO', '🏴‍☠️ USUARIO NO ENCONTRADO')
                );
                return;
            }
            mostrarPromptModalCustom(emailVal, async (nuevaClave) => {
                if (!nuevaClave) {
                    mostrarAlertaModal(
                        textoTema(
                            'No se realizó ningún cambio en la contraseña.',
                            'No se realizó ningún cambio en la clave del cofre.'
                        ),
                        '⚠️ OPERACIÓN CANCELADA'
                    );
                    return;
                }

                if (window.AppDB && window.AppDB.db) {
                    window.AppDB.db.run(`UPDATE usuarios SET password_hash = ? WHERE email = ?`, [nuevaClave, emailVal]);
                    await window.AppDB.save();
                }
                localStorage.setItem(`sgg_pass_${emailVal}`, nuevaClave);

                mostrarAlertaModal(
                    textoTema(
                        `¡Contraseña restablecida con éxito para ${emailVal}! Ahora podés iniciar sesión con tu nueva contraseña.`,
                        `¡Clave restablecida con éxito para ${emailVal}! Ahora podés embarcar con tu nueva contraseña.`
                    ),
                    textoTema('✅ CONTRASEÑA RESTABLECIDA', '⚔️ CLAVE RESTABLECIDA')
                );

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

    let idGastoAEliminar = null;
    document.addEventListener('click', (e) => {
        const btnEliminar = e.target.closest('.btn-eliminar-gasto, .btn-borrar, [data-accion="eliminar"]');

        if (btnEliminar) {
            e.preventDefault();
            e.stopPropagation();

            idGastoAEliminar = btnEliminar.getAttribute('data-id') || btnEliminar.dataset.id;

            const modalConfirmar = document.getElementById('modalConfirmar');
            if (modalConfirmar) {
                modalConfirmar.style.display = 'flex';
            }
        }
    });

    const btnAceptarEliminar = document.getElementById('btnAceptarEliminar');
    if (btnAceptarEliminar) {
        btnAceptarEliminar.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!idGastoAEliminar) return;

            try {
                if (window.AppDB && window.AppDB.db) {
                    window.AppDB.db.run(`UPDATE gastos SET activo = 0 WHERE id_gasto = ?`, [idGastoAEliminar]);
                    await window.AppDB.save();
                }

                const modalConfirmar = document.getElementById('modalConfirmar');
                if (modalConfirmar) modalConfirmar.style.display = 'none';

                if (typeof actualizarDashboard === 'function') {
                    actualizarDashboard();
                } else {
                    const fila = document.querySelector(`[data-id="${idGastoAEliminar}"]`)?.closest('tr');
                    if (fila) fila.remove();
                }
                mostrarAlertaModal(
                    textoTema(
                        'El registro ha sido eliminado exitosamente.',
                        'El registro ha sido arrojado al mar exitosamente.'
                    ),
                    textoTema('🗑️ GASTO ELIMINADO', '🌊 GASTO ELIMINADO')
                );
            } catch (error) {
                console.error('Error al conectar con la base de datos:', error);
                const modalConfirmar = document.getElementById('modalConfirmar');
                if (modalConfirmar) modalConfirmar.style.display = 'none';
                mostrarAlertaModal('Hubo un error al intentar borrar el gasto.', '❌ ERROR DE CONEXIÓN');
            }
        });
    }

    const btnCancelarEliminar = document.getElementById('btnCancelarEliminar');
    if (btnCancelarEliminar) {
        btnCancelarEliminar.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const modalConfirmar = document.getElementById('modalConfirmar');
            if (modalConfirmar) modalConfirmar.style.display = 'none';
        });
    }
});