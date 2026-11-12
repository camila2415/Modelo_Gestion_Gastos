// MÓDULO DE BASE DE DATOS SEGURA CON OPFS (Resguardado de F12 / LocalStorage)
window.AppDB = {
    db: null,
    fileName: 'sgg_database.sqlite',

    initDB: async function() {
        if (this.db) return;
       
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });

        const opfsData = await this.readFromOPFS();

        if (opfsData) {
            this.db = new SQL.Database(opfsData);
        } else {
            this.db = new SQL.Database();
            this.db.run(`
                CREATE TABLE usuarios (
                    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    nombre TEXT NOT NULL,
                    apellido TEXT NOT NULL,
                    dob TEXT NOT NULL,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE gastos (
                    id_gasto INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_usuario INTEGER NOT NULL,  
                    descripcion TEXT NOT NULL,
                    monto REAL NOT NULL CHECK (monto > 0),
                    categoria TEXT NOT NULL,
                    tipo TEXT NOT NULL DEFAULT 'egreso',
                    url_comprobante TEXT DEFAULT NULL,  
                    fecha_gasto DATE NOT NULL,
                    activo INTEGER DEFAULT 1,            
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT
                );

                CREATE INDEX idx_user_gastos ON gastos(id_usuario);
                CREATE INDEX idx_activo ON gastos(activo);
            `);

            this.db.run(`
                INSERT INTO usuarios (nombre, apellido, dob, email, username, password_hash, question, answer)
                VALUES
                ('Chopper', 'Doctor', '1990-01-01', 'chopper@gmail.com', 'chopper', 'Hola1234@', 'mascota', 'poroto');
            `);

            await this.save();
        }
    },

    readFromOPFS: async function() {
        try {
            const root = await navigator.storage.getDirectory();
            const fileHandle = await root.getFileHandle(this.fileName);
            const file = await fileHandle.getFile();
            const buffer = await file.arrayBuffer();
            return new Uint8Array(buffer);
        } catch (error) {
            console.info("Creando archivo seguro en OPFS...");
            return null;
        }
    },

    save: async function() {
        try {
            const data = this.db.export();
           
            const base64Str = btoa(String.fromCharCode.apply(null, data));
            localStorage.setItem('sgg_db_backup', base64Str);

            const root = await navigator.storage.getDirectory();
            const fileHandle = await root.getFileHandle(this.fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(data);
            await writable.close();
        } catch (error) {
            console.error("Error al guardar en OPFS:", error);
        }
    },

    query: function(sql, params = []) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const result = [];
        while (stmt.step()) {
            result.push(stmt.getAsObject());
        }
        stmt.free();
        return result;
    },

    downloadDB: async function() {
        try {
            if (!this.db) {
                await this.initDB();
            }

            const data = this.db.export();
            const blob = new Blob([data.buffer || data], { type: 'application/x-sqlite3' });
            const url = URL.createObjectURL(blob);
           
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'sgg_database.sqlite';
            document.body.appendChild(a);
           
            a.click();
           
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 300);
        } catch (error) {
            console.error("Error al descargar la base de datos:", error);
            alert("No se pudo exportar la base de datos.");
        }
    },
};

document.addEventListener('DOMContentLoaded', async () => {

    let chartDona = null;
    let chartBarras = null;
    let idGastoEnEdicion = null;
    let idGastoAEliminar = null;

    const IMGBB_API_KEY = 'c38a2e0a2948b8c2d2572b123652a281';

    let usuarioActivo = localStorage.getItem('sgg_usuario_activo') || 'chopper@gmail.com';
    localStorage.setItem('sgg_usuario_activo', usuarioActivo);

    const userEmailDisplay = document.getElementById('userEmailDisplay');
    if (userEmailDisplay) userEmailDisplay.textContent = usuarioActivo;

    // Helper centralizado para detectar el tema y modo activos
    const obtenerEstadoVisual = () => {
        const tema = document.body.getAttribute('data-tema') || localStorage.getItem('sgg_tema_estilo') || 'one-piece';
        const modo = document.body.getAttribute('data-modo') || localStorage.getItem('sgg_modo_luz') || 'light';
        return {
            esOnePiece: tema === 'one-piece',
            esDark: modo === 'dark'
        };
    };

    await window.AppDB.initDB();

    const obtenerIdUsuarioActual = () => {
        let res = window.AppDB.query(
            `SELECT id_usuario FROM usuarios WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)`,
            [usuarioActivo, usuarioActivo]
        );

        if (res.length > 0) {
            return res[0].id_usuario;
        }

        try {
            const passGuardada = localStorage.getItem(`sgg_pass_${usuarioActivo}`) || '123456';
            const usernameNuevo = usuarioActivo.split('@')[0];

            window.AppDB.db.run(
                `INSERT INTO usuarios (nombre, apellido, dob, email, username, password_hash, question, answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [usernameNuevo, 'Usuario', '2000-01-01', usuarioActivo.toLowerCase(), usernameNuevo, passGuardada, 'pregunta', 'respuesta']
            );

            window.AppDB.save();

            res = window.AppDB.query(
                `SELECT id_usuario FROM usuarios WHERE LOWER(email) = LOWER(?)`,
                [usuarioActivo]
            );

            return res.length > 0 ? res[0].id_usuario : 1;
        } catch (e) {
            console.error("Error asignando ID a usuario nuevo:", e);
            return 1;
        }
    };

    const mostrarAlertaCustom = (mensaje, tituloOverride = null) => {
        const { esOnePiece, esDark } = obtenerEstadoVisual();
        const tituloDefecto = esOnePiece ? '⚓ Aviso del Navegante' : '⚠️ Atención del Sistema';

        let modal = document.getElementById('modalAlertaDashboard');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modalAlertaDashboard';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0, 0, 0, 0.75); display: flex; align-items: center;
                justify-content: center; z-index: 9999; backdrop-filter: blur(3px);
            `;
            modal.innerHTML = `
                <div id="modalAlertaDashCaja" style="
                    border-radius: 12px; padding: 24px; max-width: 400px; width: 90%;
                    text-align: center; font-family: sans-serif; transition: all 0.2s ease;
                ">
                    <h3 id="modalAlertaDashTitulo" style="margin-top: 0; font-size: 1.3rem;"></h3>
                    <p id="modalAlertaDashMensaje" style="margin: 15px 0; line-height: 1.4;"></p>
                    <button id="btnAceptarAlertaDash" style="
                        border: none; font-weight: bold; padding: 10px 20px; border-radius: 6px;
                        cursor: pointer; font-size: 1rem; width: 100%; margin-top: 10px;
                    ">Aceptar</button>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('btnAceptarAlertaDash').addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        const caja = document.getElementById('modalAlertaDashCaja');
        const txtTitulo = document.getElementById('modalAlertaDashTitulo');
        const txtMensaje = document.getElementById('modalAlertaDashMensaje');
        const btnAceptar = document.getElementById('btnAceptarAlertaDash');

        if (esOnePiece) {
            caja.style.background = '#1a0f07';
            caja.style.border = '2px solid #ff9900';
            caja.style.boxShadow = '0 0 20px rgba(255, 153, 0, 0.4)';
            txtTitulo.style.color = '#ff9900';
            txtMensaje.style.color = '#e0d0b0';
            btnAceptar.style.background = 'linear-gradient(135deg, #ff9900, #e67e00)';
            btnAceptar.style.color = '#1a0f07';
        } else if (esDark) {
            caja.style.background = '#1e293b';
            caja.style.border = '2px solid #3b82f6';
            caja.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.35)';
            txtTitulo.style.color = '#60a5fa';
            txtMensaje.style.color = '#f1f5f9';
            btnAceptar.style.background = '#3b82f6';
            btnAceptar.style.color = '#ffffff';
        } else {
            caja.style.background = '#ffffff';
            caja.style.border = '2px solid #2563eb';
            caja.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)';
            txtTitulo.style.color = '#1d4ed8';
            txtMensaje.style.color = '#334155';
            btnAceptar.style.background = '#2563eb';
            btnAceptar.style.color = '#ffffff';
        }

        txtTitulo.textContent = tituloOverride || tituloDefecto;
        txtMensaje.textContent = mensaje;
        modal.style.display = 'flex';
    };

    const subirComprobanteAPI = async (fileInput) => {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) return null;

        const archivo = fileInput.files[0];

        try {
            const formData = new FormData();
            formData.append('image', archivo);
           
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data && data.data && data.data.url) {
                return data.data.url;
            }
        } catch (err) {
            console.warn("⚠️ API ImgBB no disponible, aplicando compresión local...");
        }

        return new Promise((resolve) => {
            const img = new Image();
            const reader = new FileReader();

            reader.onload = (e) => {
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_ANCHO = 500;
                    const escala = MAX_ANCHO / img.width;
                    canvas.width = (img.width > MAX_ANCHO) ? MAX_ANCHO : img.width;
                    canvas.height = (img.width > MAX_ANCHO) ? img.height * escala : img.height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                };
                img.onerror = () => resolve(null);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(archivo);
        });
    };

    const renderizarGraficos = (egresosPorCat, ingresos, egresos) => {
        if (typeof Chart === 'undefined') return;

        const { esOnePiece, esDark } = obtenerEstadoVisual();

        const colorTexto = esDark ? '#f1f5f9' : '#0f172a';
        const colorGrilla = esDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.1)';

        // Etiquetas dinámicas según tema activo
        const etiquetasCategorias = {
            'Comida': esOnePiece ? '🍖 Comida / Provisiones' : '🍽️ Alimentos y Suministros',
            'Navegación': esOnePiece ? '⚓ Navegación' : '💰 Ahorro / Emergencia',
            'Medicina': esOnePiece ? '💊 Medicina' : '🏥 Salud y Medicina',
            'Entretenimiento': esOnePiece ? '🎵 Entretenimiento' : '🎬 Entretenimiento',
            'Mapas': esOnePiece ? '🗺️ Mapas y Log Pose' : '📚 Educación',
            'Tesoro': esOnePiece ? '💎 Tesoro' : '💵 Ingresos / Salarios',
            'Varios': esOnePiece ? '📌 Varios' : '📌 Gastos Varios'
        };

        // Paleta de colores adaptada al tema
        const paletaColores = esOnePiece
            ? ['#f59e0b', '#ef4444', '#eab308', '#d97706', '#b45309', '#fb923c', '#78350f']
            : ['#3b82f6', '#10b981', '#8b5cf6', '#f43f5e', '#06b6d4', '#f59e0b', '#64748b'];

        const canvasDona = document.getElementById('chartDona') || document.querySelectorAll('canvas')[0];
        if (canvasDona) {
            if (chartDona) chartDona.destroy();

            const catsCrudas = Object.keys(egresosPorCat);
            const vals = Object.values(egresosPorCat);
            const hayDatos = catsCrudas.length > 0 && vals.some(v => v > 0);

            const labelsFormateadas = hayDatos
                ? catsCrudas.map(c => etiquetasCategorias[c] || c)
                : [esOnePiece ? 'Sin egresos en la bitácora' : 'Sin gastos registrados'];

            chartDona = new Chart(canvasDona, {
                type: 'doughnut',
                data: {
                    labels: labelsFormateadas,
                    datasets: [{
                        data: hayDatos ? vals : [1],
                        backgroundColor: hayDatos ? paletaColores : [esDark ? '#334155' : '#cbd5e1'],
                        borderColor: esDark ? '#1e293b' : '#ffffff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: colorTexto, padding: 14, font: { size: 12 } }
                        },
                        tooltip: {
                            enabled: hayDatos,
                            callbacks: {
                                label: (ctx) => ` ${ctx.label}: $${Number(ctx.raw).toFixed(2)}`
                            }
                        }
                    }
                }
            });
        }

        const canvasBarras = document.getElementById('chartBarras') || document.querySelectorAll('canvas')[1];
        if (canvasBarras) {
            if (chartBarras) chartBarras.destroy();

            const labelEgreso = esOnePiece ? 'Egresos' : 'Gastos';

            chartBarras = new Chart(canvasBarras, {
                type: 'bar',
                data: {
                    labels: ['Ingresos', labelEgreso],
                    datasets: [{
                        label: esOnePiece ? 'Monto (Bellys / $)' : 'Monto ($)',
                        data: [ingresos, egresos],
                        backgroundColor: ['#10b981', '#ef4444'],
                        borderRadius: 6,
                        maxBarThickness: 70
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => ` $${Number(ctx.raw).toFixed(2)}`
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: colorTexto, font: { weight: 'bold' } },
                            grid: { display: false }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: colorTexto,
                                callback: (value) => '$' + value
                            },
                            grid: { color: colorGrilla }
                        }
                    }
                }
            });
        }
    };

    const actualizarDashboard = () => {
        const { esOnePiece } = obtenerEstadoVisual();
        const idUser = obtenerIdUsuarioActual();
        const movimientos = window.AppDB.query(
            `SELECT * FROM gastos WHERE id_usuario = ? AND activo = 1 ORDER BY fecha_gasto DESC, id_gasto DESC`,
            [idUser]
        );

        let balance = 0;
        let totalIngresos = 0;
        let totalEgresos = 0;
        let egresosPorCat = {};

        const nombresCategoriasTabla = {
            'Comida': esOnePiece ? '🍖 Comida' : '🍽️ Alimentos y Suministros',
            'Navegación': esOnePiece ? '⚓ Navegación' : '💰 Ahorro / Emergencia',
            'Medicina': esOnePiece ? '💊 Medicina' : '🏥 Salud y Medicina',
            'Entretenimiento': esOnePiece ? '🎵 Entretenimiento' : '🎬 Entretenimiento',
            'Mapas': esOnePiece ? '🗺️ Mapas' : '📚 Educación',
            'Tesoro': esOnePiece ? '💎 Tesoro' : '💵 Ingresos / Salarios',
            'Varios': esOnePiece ? '📌 Varios' : '📌 Gastos Varios'
        };

        const tablaBody = document.getElementById('tablaGastosBody') || document.querySelector('tbody');
        if (tablaBody) tablaBody.innerHTML = '';

        if (movimientos.length === 0 && tablaBody) {
            tablaBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:15px; opacity:0.6;">No hay movimientos registrados.</td></tr>`;
        }

        movimientos.forEach(m => {
            const monto = Number(m.monto) || 0;
            const esIngreso = m.tipo.toLowerCase().includes('ingreso');

            if (esIngreso) {
                balance += monto;
                totalIngresos += monto;
            } else {
                balance -= monto;
                totalEgresos += monto;
                const cat = m.categoria || 'Varios';
                egresosPorCat[cat] = (egresosPorCat[cat] || 0) + monto;
            }

            if (tablaBody) {
                const tr = document.createElement('tr');
                const catMostrar = nombresCategoriasTabla[m.categoria] || m.categoria || 'General';
                const tipoMostrar = esIngreso
                    ? '🟢 Ingreso'
                    : (esOnePiece ? '🔴 Egreso' : '🔴 Gasto');

                tr.innerHTML = `
                    <td>${m.fecha_gasto || '-'}</td>
                    <td><b style="color:${esIngreso ? '#10b981' : '#ef4444'}">${tipoMostrar}</b></td>
                    <td>${catMostrar}</td>
                    <td>${m.descripcion || ''}</td>
                    <td style="font-weight:bold; color:${esIngreso ? '#10b981' : '#ef4444'}">${esIngreso ? '+' : '-'}$${monto.toFixed(2)}</td>
                    <td>${m.url_comprobante ? `<a href="${m.url_comprobante}" target="_blank" style="color:#3b82f6;">📎 Ticket</a>` : 'Sin ticket'}</td>
                    <td>
                        <button type="button" class="btn-editar" data-id="${m.id_gasto}" style="cursor:pointer; padding:2px 6px; margin-right:4px;">✏️</button>
                        <button type="button" class="btn-eliminar" data-id="${m.id_gasto}" style="cursor:pointer; padding:2px 6px;">🗑️</button>
                    </td>
                `;
                tablaBody.appendChild(tr);
            }
        });

        const balanceEl = document.getElementById('totalGastado');
        if (balanceEl) {
            balanceEl.textContent = `${balance.toFixed(2)}`;
            balanceEl.style.color = balance >= 0 ? '#10b981' : '#ef4444';
        }

        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                const id = Number(e.currentTarget.getAttribute('data-id'));
                const gasto = movimientos.find(item => item.id_gasto === id);
                if (gasto) {
                    const formGasto = document.getElementById('formGasto') || document.querySelector('form');
                    const tipoEl = document.getElementById('tipoMovimiento') || formGasto.querySelector('select');
                    const montoEl = document.getElementById('monto') || formGasto.querySelector('input[type="number"]');
                    const catEl = document.getElementById('categoria');
                    const fechaEl = document.getElementById('fecha') || formGasto.querySelector('input[type="date"]');
                    const descEl = document.getElementById('descripcion');
                    const btnSubmit = document.getElementById('btnGuardar') || formGasto.querySelector('button[type="submit"]');

                    if (tipoEl) tipoEl.value = gasto.tipo;
                    if (montoEl) montoEl.value = gasto.monto;
                    if (catEl) catEl.value = gasto.categoria;
                    if (fechaEl) fechaEl.value = gasto.fecha_gasto;
                    if (descEl) descEl.value = gasto.descripcion;

                    idGastoEnEdicion = id;
                    if (btnSubmit) btnSubmit.textContent = "💾 Guardar Cambios";

                    mostrarAlertaCustom("Modificá los campos en el formulario y presioná 'Guardar Cambios'.", "✏️ Modo Edición");
                }
            };
        });

        document.querySelectorAll('.btn-eliminar, .btn-eliminar-gasto').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                idGastoAEliminar = Number(e.currentTarget.getAttribute('data-id'));

                const modalConfirmar = document.getElementById('modalConfirmar');
                if (modalConfirmar) {
                    modalConfirmar.style.display = 'flex';
                }
            };
        });

        renderizarGraficos(egresosPorCat, totalIngresos, totalEgresos);
    };

    const btnAceptarEliminar = document.getElementById('btnAceptarEliminar');
    const btnCancelarEliminar = document.getElementById('btnCancelarEliminar');

    if (btnAceptarEliminar) {
        btnAceptarEliminar.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (idGastoAEliminar) {
                window.AppDB.db.run(`UPDATE gastos SET activo = 0 WHERE id_gasto = ?`, [idGastoAEliminar]);
                await window.AppDB.save();
                idGastoAEliminar = null;

                const modalConfirmar = document.getElementById('modalConfirmar');
                if (modalConfirmar) modalConfirmar.style.display = 'none';

                actualizarDashboard();

                const { esOnePiece } = obtenerEstadoVisual();
                if (esOnePiece) {
                    mostrarAlertaCustom("El gasto ha sido arrojado al mar exitosamente.", "🌊 Gasto Eliminado");
                } else {
                    mostrarAlertaCustom("El gasto ha sido eliminado correctamente del sistema.", "🗑️ Registro Eliminado");
                }
            }
        };
    }

    if (btnCancelarEliminar) {
        btnCancelarEliminar.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            idGastoAEliminar = null;
            const modalConfirmar = document.getElementById('modalConfirmar');
            if (modalConfirmar) modalConfirmar.style.display = 'none';
        };
    }

    const restaurarBotonGuardar = (btnSubmit) => {
        if (!btnSubmit) return;
        const { esOnePiece } = obtenerEstadoVisual();
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = esOnePiece
            ? `<span class="txt-onepiece">⚔️ Guardar en la Bitácora</span><span class="txt-normal">💾 Guardar Registro</span>`
            : `<span class="txt-onepiece">⚔️ Guardar en la Bitácora</span><span class="txt-normal">💾 Guardar Registro</span>`;
    };

    const procesarGuardadoGasto = async (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const formGasto = document.getElementById('formGasto') || document.querySelector('form');
        if (!formGasto) return;

        const tipoEl = document.getElementById('tipoMovimiento') || document.getElementById('tipo') || formGasto.querySelector('select');
        const montoEl = document.getElementById('monto') || formGasto.querySelector('input[type="number"]');
        const catEl = document.getElementById('categoria') || formGasto.querySelector('select[name="categoria"]');
        const fechaEl = document.getElementById('fecha') || formGasto.querySelector('input[type="date"]');
        const descEl = document.getElementById('descripcion') || document.getElementById('desc');
        const fileEl = document.getElementById('comprobanteFile') || formGasto.querySelector('input[type="file"]');
        const btnSubmit = document.getElementById('btnGuardar') || formGasto.querySelector('button[type="submit"]');

        const valMonto = montoEl ? parseFloat(montoEl.value) : 0;
        const valFecha = fechaEl ? fechaEl.value.trim() : '';
        const valCat = catEl ? catEl.value.trim() : '';
        const valDesc = descEl ? descEl.value.trim() : '';

        if (isNaN(valMonto) || valMonto <= 0) {
            mostrarAlertaCustom("Por favor ingresá un monto mayor a 0.");
            return;
        }
        if (!valFecha) {
            mostrarAlertaCustom("Por favor seleccioná la fecha del movimiento.");
            return;
        }
        if (!valCat) {
            mostrarAlertaCustom("Por favor seleccioná una categoría para el movimiento.");
            return;
        }
        if (!valDesc) {
            mostrarAlertaCustom("Por favor ingresá una descripción.");
            return;
        }

        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = "⏳ Guardando...";
        }

        let urlTicket = await subirComprobanteAPI(fileEl);
        const idUser = obtenerIdUsuarioActual();

        if (idGastoEnEdicion) {
            window.AppDB.db.run(
                `UPDATE gastos SET tipo = ?, monto = ?, categoria = ?, fecha_gasto = ?, descripcion = ?, url_comprobante = COALESCE(?, url_comprobante) WHERE id_gasto = ?`,
                [tipoEl ? tipoEl.value.toLowerCase() : 'egreso', Number(valMonto), valCat, valFecha, valDesc, urlTicket, idGastoEnEdicion]
            );
            idGastoEnEdicion = null;
            mostrarAlertaCustom("¡Movimiento actualizado correctamente!", "💾 Guardado Exitoso");
        } else {
            window.AppDB.db.run(
                `INSERT INTO gastos (id_usuario, descripcion, monto, categoria, tipo, url_comprobante, fecha_gasto) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [idUser, valDesc, Number(valMonto), valCat, tipoEl ? tipoEl.value.toLowerCase() : 'egreso', urlTicket, valFecha]
            );
            mostrarAlertaCustom("¡Movimiento registrado correctamente!", "🎉 Registro Exitoso");
        }

        await window.AppDB.save();

        restaurarBotonGuardar(btnSubmit);

        if (montoEl) montoEl.value = '';
        if (descEl) descEl.value = '';
        if (catEl) catEl.value = '';
        if (fileEl) fileEl.value = '';

        actualizarDashboard();
    };

    const formEl = document.getElementById('formGasto') || document.querySelector('form');
    if (formEl) {
        formEl.onsubmit = procesarGuardadoGasto;
    }

    // Gestión de Cierre de Sesión
    const btnAbandonar = document.getElementById('btnLogout') || document.getElementById('btnAbandonar');
    const modalLogout = document.getElementById('modalCerrarSesion') || document.getElementById('modalLogoutCustom');
    const btnAceptarLogout = document.getElementById('btnAceptarLogout') || document.getElementById('btnAceptarLogoutCustom');
    const btnCancelarLogout = document.getElementById('btnCancelarLogout') || document.getElementById('btnCancelarLogoutCustom');

    if (btnAbandonar) {
        btnAbandonar.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (modalLogout) {
                modalLogout.style.display = 'flex';
            } else if (confirm("¿Deseas cerrar sesión?")) {
                localStorage.removeItem('sgg_usuario_activo');
                window.location.href = 'index.html';
            }
        };
    }

    if (btnAceptarLogout) {
        btnAceptarLogout.onclick = (e) => {
            e.preventDefault();
            localStorage.removeItem('sgg_usuario_activo');
            window.location.href = 'index.html';
        };
    }

    if (btnCancelarLogout) {
        btnCancelarLogout.onclick = (e) => {
            e.preventDefault();
            if (modalLogout) modalLogout.style.display = 'none';
        };
    }

    window.addEventListener('cambioTemaModo', actualizarDashboard);

    actualizarDashboard();

    const btnDescargarBD = document.getElementById('btnDescargarBD');
    if (btnDescargarBD) {
        btnDescargarBD.addEventListener('click', async (e) => {
            e.preventDefault();
            await window.AppDB.downloadDB();
        });
    }

    const modalAjustes = document.getElementById('modalAjustes');
    const btnAbrirAjustes = document.getElementById('btnAbrirAjustes');
    const btnCerrarAjustes = document.getElementById('btnCerrarAjustes');

    if (btnAbrirAjustes && modalAjustes) {
        btnAbrirAjustes.addEventListener('click', () => {
            modalAjustes.style.display = 'flex';
        });
    }

    if (btnCerrarAjustes && modalAjustes) {
        btnCerrarAjustes.addEventListener('click', () => {
            modalAjustes.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modalAjustes) {
            modalAjustes.style.display = 'none';
        }
    });

    const btnImportarBD = document.getElementById('btnImportarBD');
    const inputImportarBD = document.getElementById('inputImportarBD');

    if (btnImportarBD && inputImportarBD) {
        btnImportarBD.addEventListener('click', () => {
            inputImportarBD.click();
        });

        inputImportarBD.addEventListener('change', async (e) => {
            const archivo = e.target.files[0];
            if (!archivo) return;

            try {
                const reader = new FileReader();

                reader.onload = async function(event) {
                    const arrayBuffer = event.target.result;
                    const uInt8Array = new Uint8Array(arrayBuffer);

                    if (window.AppDB) {
                        const SQL = await initSqlJs({
                            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
                        });

                        window.AppDB.db = new SQL.Database(uInt8Array);

                        const idUserActual = obtenerIdUsuarioActual();

                        window.AppDB.db.run(`UPDATE gastos SET id_usuario = ? WHERE id_usuario IS NULL OR id_usuario = 0`, [idUserActual]);

                        await window.AppDB.save();

                        actualizarDashboard();

                        if (modalAjustes) {
                            modalAjustes.style.display = 'none';
                        }

                        const { esOnePiece } = obtenerEstadoVisual();
                        mostrarAlertaCustom(
                            esOnePiece
                                ? "¡Bitácora SQLite cargada correctamente manteniendo el aislamiento de cuentas!"
                                : "¡Base de datos cargada correctamente manteniendo el aislamiento de cuentas!",
                            esOnePiece ? "🏴‍☠️ Base de Datos Cargada" : "💾 Base de Datos Cargada"
                        );
                    }
                };

                reader.readAsArrayBuffer(archivo);
            } catch (err) {
                console.error('Error al importar la base de datos:', err);
                mostrarAlertaCustom("Ocurrió un error al intentar leer el archivo .sqlite", "❌ Error de Carga");
            } finally {
                inputImportarBD.value = '';
            }
        });
    }
});