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
            const data = this.db.export(); // Exporta el binario SQLite
            const blob = new Blob([data], { type: 'application/x-sqlite3' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = this.fileName; // sgg_database.sqlite
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error al descargar la base de datos:", error);
        }
    }
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

    await window.AppDB.initDB();

    const obtenerIdUsuarioActual = () => {
        const res = window.AppDB.query(`SELECT id_usuario FROM usuarios WHERE email = ? OR username = ?`, [usuarioActivo, usuarioActivo]);
        return res.length > 0 ? res[0].id_usuario : 1;
    };

    const mostrarAlertaCustom = (mensaje, tituloOverride = null) => {
        const modal = document.getElementById('modalAlertaCustom');
        const txtTitulo = document.getElementById('modalAlertaTitulo');
        const txtMensaje = document.getElementById('modalAlertaMensaje');
        const btnAceptar = document.getElementById('btnAceptarAlertaCustom');

        const selectTema = document.getElementById('selectorTema') || document.querySelector('select');
        const valTema = selectTema ? selectTema.value.toLowerCase() : '';
        const esOnePiece = valTema.includes('piece') || document.body.getAttribute('data-tema') === 'one-piece';

        const tituloDefecto = esOnePiece ? '⚠️ Aviso del Navegante' : '⚠️ Atención del Sistema';

        if (modal && txtMensaje) {
            if (txtTitulo) txtTitulo.textContent = tituloOverride || tituloDefecto;
            txtMensaje.textContent = mensaje;
            modal.style.display = 'flex';

            if (btnAceptar) {
                btnAceptar.onclick = () => { modal.style.display = 'none'; };
            }
        } else {
            alert(`${tituloOverride || tituloDefecto}\n\n${mensaje}`);
        }
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

    const actualizarDashboard = () => {
        const idUser = obtenerIdUsuarioActual();
        const movimientos = window.AppDB.query(
            `SELECT * FROM gastos WHERE id_usuario = ? AND activo = 1 ORDER BY fecha_gasto DESC, id_gasto DESC`, 
            [idUser]
        );

        let balance = 0;
        let totalIngresos = 0;
        let totalEgresos = 0;
        let egresosPorCat = {};

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
                tr.innerHTML = `
                    <td>${m.fecha_gasto || '-'}</td>
                    <td><b style="color:${esIngreso ? '#10b981' : '#ef4444'}">${esIngreso ? '🟢 Ingreso' : '🔴 Egreso'}</b></td>
                    <td>${m.categoria || 'General'}</td>
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
                    const tipoEl = formGasto.querySelector('select');
                    const montoEl = formGasto.querySelector('input[type="number"]');
                    const catEl = document.getElementById('categoria') || formGasto.querySelectorAll('input[type="text"]')[0];
                    const fechaEl = formGasto.querySelector('input[type="date"]');
                    const descEl = document.getElementById('descripcion') || formGasto.querySelectorAll('input[type="text"]')[1];
                    const btnSubmit = formGasto.querySelector('button');

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
                    const selectTema = document.getElementById('selectorTema') || document.querySelector('select');
                    const valTema = selectTema ? selectTema.value.toLowerCase() : '';
                    const esOnePiece = valTema.includes('piece') || document.body.getAttribute('data-tema') === 'one-piece';

                    const tituloModal = modalConfirmar.querySelector('.modal-titulo') || modalConfirmar.querySelector('h3');
                    const mensajeModal = modalConfirmar.querySelector('.modal-mensaje') || modalConfirmar.querySelector('p');
                    const btnAceptar = modalConfirmar.querySelector('#btnAceptarEliminar') || modalConfirmar.querySelector('.btn-danger');

                    if (esOnePiece) {
                        if (tituloModal) tituloModal.textContent = "🌊 ¿Arrojar al mar?";
                        if (mensajeModal) mensajeModal.textContent = "¿Estás seguro de que deseas eliminar este movimiento?";
                        if (btnAceptar) btnAceptar.textContent = "Sí, Arrojar";
                    } else {
                        if (tituloModal) tituloModal.textContent = "🗑️ Eliminar Registro";
                        if (mensajeModal) mensajeModal.textContent = "¿Estás seguro de que deseas eliminar este gasto de la lista?";
                        if (btnAceptar) btnAceptar.textContent = "Sí, Eliminar";
                    }

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

                const selectTema = document.getElementById('selectorTema') || document.querySelector('select');
                const valTema = selectTema ? selectTema.value.toLowerCase() : '';
                const esOnePiece = valTema.includes('piece') || document.body.getAttribute('data-tema') === 'one-piece';

                if (esOnePiece) {
                    mostrarAlertaCustom("El gasto ha sido arrojado al mar exitosamente.", "🌊 Gasto Eliminado");
                } else {
                    mostrarAlertaCustom("El gasto ha sido eliminado correctamente del sistema.", "Registro Eliminado");
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

    const renderizarGraficos = (egresosPorCat, ingresos, egresos) => {
        if (typeof Chart === 'undefined') return;

        const modo = document.body.getAttribute('data-modo') || 'light';
        const colorTexto = modo === 'dark' ? '#ffffff' : '#0f172a';

        const canvasDona = document.getElementById('chartDona') || document.querySelectorAll('canvas')[0];
        if (canvasDona) {
            if (chartDona) chartDona.destroy();
            const cats = Object.keys(egresosPorCat);
            const vals = Object.values(egresosPorCat);

            chartDona = new Chart(canvasDona, {
                type: 'doughnut',
                data: {
                    labels: cats.length ? cats : ['Sin egresos'],
                    datasets: [{
                        data: vals.length ? vals : [1],
                        backgroundColor: ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: colorTexto } } } }
            });
        }

        const canvasBarras = document.getElementById('chartBarras') || document.querySelectorAll('canvas')[1];
        if (canvasBarras) {
            if (chartBarras) chartBarras.destroy();
            chartBarras = new Chart(canvasBarras, {
                type: 'bar',
                data: {
                    labels: ['Ingresos', 'Egresos'],
                    datasets: [{ label: 'Monto ($)', data: [ingresos, egresos], backgroundColor: ['#10b981', '#ef4444'] }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: colorTexto } } },
                    scales: { x: { ticks: { color: colorTexto } }, y: { ticks: { color: colorTexto } } }
                }
            });
        }
    };

    const procesarGuardadoGasto = async (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const formGasto = document.getElementById('formGasto') || document.querySelector('form');
        if (!formGasto) return;

        const tipoEl = formGasto.querySelector('select');
        const montoEl = formGasto.querySelector('input[type="number"]');
        const catEl = document.getElementById('categoria') || formGasto.querySelectorAll('input[type="text"]')[0];
        const fechaEl = formGasto.querySelector('input[type="date"]');
        const descEl = document.getElementById('descripcion') || formGasto.querySelectorAll('input[type="text"]')[1];
        const fileEl = formGasto.querySelector('input[type="file"]') || document.getElementById('comprobante');
        const btnSubmit = formGasto.querySelector('button');

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
            mostrarAlertaCustom("Por favor ingresá la categoría del movimiento.");
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
            if (btnSubmit) btnSubmit.textContent = "Registrar Movimiento";
            mostrarAlertaCustom("¡Movimiento actualizado correctamente!", "💾 Guardado Exitoso");
        } else {
            window.AppDB.db.run(
                `INSERT INTO gastos (id_usuario, descripcion, monto, categoria, tipo, url_comprobante, fecha_gasto) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [idUser, valDesc, Number(valMonto), valCat, tipoEl ? tipoEl.value.toLowerCase() : 'egreso', urlTicket, valFecha]
            );
            mostrarAlertaCustom("¡Movimiento registrado correctamente!", "🎉 Registro Exitoso");
        }

        await window.AppDB.save();

        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Registrar Movimiento";
        }

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

    const btnAbandonar = document.getElementById('btnAbandonar') || document.getElementById('btnLogout') || document.querySelector('.btn-danger');
    const modalLogout = document.getElementById('modalLogoutCustom');
    const btnAceptarLogout = document.getElementById('btnAceptarLogoutCustom');
    const btnCancelarLogout = document.getElementById('btnCancelarLogoutCustom');

    if (btnAbandonar) {
        btnAbandonar.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const selectTema = document.getElementById('selectorTema') || document.querySelectorAll('select')[0];
            const textoTemaSelect = selectTema ? selectTema.options[selectTema.selectedIndex].text.toLowerCase() : '';
            const temaAttr = document.body.getAttribute('data-tema') || '';
            const esOnePiece = textoTemaSelect.includes('piece') || temaAttr === 'one-piece';

            if (modalLogout) {
                const tituloModal = modalLogout.querySelector('.modal-titulo');
                const mensajeModal = modalLogout.querySelector('.modal-mensaje');

                if (esOnePiece) {
                    if (tituloModal) tituloModal.textContent = "⚓ ¡Atención Capitán!";
                    if (mensajeModal) mensajeModal.textContent = "¿Estás seguro de que deseas abandonar el barco y cerrar sesión?";
                    if (btnAceptarLogout) btnAceptarLogout.textContent = "Sí, Abandonar";
                } else {
                    if (tituloModal) tituloModal.textContent = "🔐 Cerrar Sesión";
                    if (mensajeModal) mensajeModal.textContent = "¿Estás seguro de que deseas salir del sistema?";
                    if (btnAceptarLogout) btnAceptarLogout.textContent = "Sí, Salir";
                }

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
});