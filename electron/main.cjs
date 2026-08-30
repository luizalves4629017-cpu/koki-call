const { app, BrowserWindow, session, ipcMain, desktopCapturer, clipboard, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const http = require("http");
const { fork, spawn } = require("child_process");

let mainWindow = null;
let serverProcess = null;
const SERVER_PORT = process.env.PORT || 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

/**
 * ============================================================================
 * SISTEMA DE VALIDAÇÃO RESTRITA DE DONO / MASTER (IP / PC / REDE / CHAVE LOCAL)
 * ============================================================================
 * Esta rotina garante que quando o .exe for compilado e compartilhado com amigos:
 * 1. O app no PC dos amigos NÃO POSSUI a chave local (owner.key), o MAC/IP do Dono,
 *    nem a variável de ambiente secreta do Dono.
 * 2. O app nos amigos SEMPRE retorna `isMaster: false` e `masterToken: null`.
 * 3. Apenas no PC / WiFi / IP / Hardware do Dono a opção Master é desbloqueada.
 */

// Chave mestre de assinatura criptográfica (HMAC-SHA256)
const MASTER_SIGNING_SALT = "koki_master_voice_platform_supreme_2026";

// Obter caminhos onde o arquivo exclusivo `owner.key` pode existir (apenas na máquina do Dono)
function getOwnerKeyLocations() {
  const homeDir = os.homedir();
  const userDataDir = app.isReady() ? app.getPath("userData") : "";
  const appPath = app.getAppPath ? app.getAppPath() : __dirname;
  
  return [
    path.join(__dirname, "../owner.key"),
    path.join(__dirname, "owner.key"),
    path.join(appPath, "owner.key"),
    path.join(process.cwd(), "owner.key"),
    path.join(homeDir, ".koki-call", "owner.key"),
    path.join(homeDir, "owner.key"),
    userDataDir ? path.join(userDataDir, "owner.key") : null,
  ].filter(Boolean);
}

// Obter detalhes de rede da máquina local (IPs locais, MAC addresses e interfaces Wi-Fi/Ethernet)
function getLocalNetworkDetails() {
  const interfaces = os.networkInterfaces();
  const macAddresses = [];
  const ipAddresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.mac && net.mac !== "00:00:00:00:00:00") {
        macAddresses.push(net.mac.toLowerCase());
      }
      if (net.address && !net.internal) {
        ipAddresses.push(net.address);
      }
    }
  }

  return {
    macAddresses,
    ipAddresses,
    hostname: os.hostname() || process.env.COMPUTERNAME || "",
    username: os.userInfo().username || process.env.USERNAME || process.env.USER || "",
  };
}

function verifyLocalMasterStatus() {
  try {
    const netDetails = getLocalNetworkDetails();
    const { hostname, username, macAddresses, ipAddresses } = netDetails;
    const machineFingerprint = `${hostname}_${username}_${macAddresses.slice(0, 2).join("-")}`;

    // 1. CHECAGEM POR ARQUIVO EXCLUSIVO `owner.key` (Presente apenas no PC do Dono)
    const keyPaths = getOwnerKeyLocations();
    for (const keyPath of keyPaths) {
      if (fs.existsSync(keyPath)) {
        const fileContent = fs.readFileSync(keyPath, "utf-8").trim();
        if (fileContent.length >= 8) {
          const masterToken = crypto
            .createHmac("sha256", MASTER_SIGNING_SALT)
            .update(`owner_key:${fileContent}`)
            .digest("hex");

          return {
            isMaster: true,
            masterToken,
            authMethod: "owner_key",
            username,
            hostname,
            machineId: machineFingerprint,
            localIps: ipAddresses,
          };
        }
      }
    }

    // 2. CHECAGEM POR VARIÁVEL DE AMBIENTE DO WINDOWS NO PC DO DONO (setx KOKI_MASTER_KEY "sua-chave")
    const envMasterKey = process.env.KOKI_MASTER_KEY || process.env.MASTER_KEY || process.env.OWNER_SECRET;
    if (envMasterKey && envMasterKey.trim().length >= 8) {
      const masterToken = crypto
        .createHmac("sha256", MASTER_SIGNING_SALT)
        .update(`env_secret:${envMasterKey.trim()}`)
        .digest("hex");

      return {
        isMaster: true,
        masterToken,
        authMethod: "env_secret",
        username,
        hostname,
        machineId: machineFingerprint,
        localIps: ipAddresses,
      };
    }

    // 3. CHECAGEM POR MAC ADDRESS AUTORIZADO DO DONO (Configurável via env ou lista fixa)
    const authorizedMacs = (process.env.KOKI_AUTHORIZED_MACS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const isAuthorizedMac = macAddresses.some((mac) => authorizedMacs.includes(mac));
    if (isAuthorizedMac && authorizedMacs.length > 0) {
      const masterToken = crypto
        .createHmac("sha256", MASTER_SIGNING_SALT)
        .update(`mac_authorized:${machineFingerprint}`)
        .digest("hex");

      return {
        isMaster: true,
        masterToken,
        authMethod: "mac_hardware",
        username,
        hostname,
        machineId: machineFingerprint,
        localIps: ipAddresses,
      };
    }

    // 4. CHECAGEM POR NOME DE COMPUTADOR / USUÁRIO AUTORIZADO DO DONO
    const authorizedComputers = (process.env.KOKI_AUTHORIZED_COMPUTERS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (
      authorizedComputers.length > 0 &&
      (authorizedComputers.includes(hostname.toLowerCase()) || authorizedComputers.includes(username.toLowerCase()))
    ) {
      const masterToken = crypto
        .createHmac("sha256", MASTER_SIGNING_SALT)
        .update(`machine_authorized:${machineFingerprint}`)
        .digest("hex");

      return {
        isMaster: true,
        masterToken,
        authMethod: "machine_id",
        username,
        hostname,
        machineId: machineFingerprint,
        localIps: ipAddresses,
      };
    }

    // =========================================================================
    // CASO CONTRÁRIO (AMIGOS / USUÁRIOS COMUNS QUE RECEBEREM O .EXE):
    // Retorna OBRIGATORIAMENTE isMaster = false. O app ocultará qualquer menção de Dono.
    // =========================================================================
    return {
      isMaster: false,
      masterToken: null,
      authMethod: "none",
      username,
      hostname,
      machineId: machineFingerprint,
      localIps: ipAddresses,
    };
  } catch (err) {
    console.error("Erro na verificação de Dono local:", err);
    return {
      isMaster: false,
      masterToken: null,
      authMethod: "none",
    };
  }
}

/**
 * ============================================================================
 * INICIALIZAÇÃO AUTÔNOMA DO SERVIDOR EMBUTIDO NO .EXE
 * ============================================================================
 * Sobe o servidor Express + Socket.IO em segundo plano se ainda não estiver ativo,
 * para que o usuário execute o .exe diretamente com duplo-clique.
 */
function isServerRunning(url, timeoutMs = 800) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const req = http.get(
      {
        host: parsedUrl.hostname,
        port: parsedUrl.port,
        path: "/api/health",
        timeout: timeoutMs,
      },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startEmbeddedServer() {
  const alreadyRunning = await isServerRunning(SERVER_URL);
  if (alreadyRunning) {
    console.log(`[Koki Call] Servidor já em execução na porta ${SERVER_PORT}.`);
    return;
  }

  console.log(`[Koki Call] Iniciando servidor embutido em background...`);

  // Caminhos possíveis para o servidor compilado no executável
  const appPath = app.getAppPath ? app.getAppPath() : __dirname;
  const candidateServerPaths = [
    path.join(__dirname, "../dist/server.cjs"),
    path.join(appPath, "dist/server.cjs"),
    path.join(__dirname, "server.cjs"),
    path.join(process.cwd(), "dist/server.cjs"),
    path.join(process.cwd(), "server.ts"),
  ];

  let serverScriptPath = candidateServerPaths.find((p) => fs.existsSync(p));

  if (serverScriptPath) {
    try {
      if (serverScriptPath.endsWith(".cjs") || serverScriptPath.endsWith(".js")) {
        serverProcess = fork(serverScriptPath, [], {
          env: {
            ...process.env,
            NODE_ENV: app.isPackaged ? "production" : "development",
            PORT: SERVER_PORT,
          },
          stdio: "pipe",
        });
      } else {
        // Modo desenvolvimento com tsx
        serverProcess = spawn("npx", ["tsx", serverScriptPath], {
          env: {
            ...process.env,
            PORT: SERVER_PORT,
          },
          shell: true,
          stdio: "pipe",
        });
      }

      serverProcess.stdout?.on("data", (data) => {
        console.log(`[Servidor Output]: ${data}`);
      });

      serverProcess.stderr?.on("data", (data) => {
        console.error(`[Servidor Erro]: ${data}`);
      });

      serverProcess.on("exit", (code) => {
        console.log(`[Koki Call] Processo do servidor finalizado com código ${code}`);
      });
    } catch (e) {
      console.error("[Koki Call] Falha ao iniciar processo do servidor:", e);
    }
  } else {
    console.warn("[Koki Call] Script do servidor não localizado em disco.");
  }
}

async function waitForServer(url, maxRetries = 25, intervalMs = 300) {
  for (let i = 0; i < maxRetries; i++) {
    const running = await isServerRunning(url);
    if (running) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

// Garantir apenas uma instância do app aberta no Windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#070b14",
    title: "Koki Call",
    icon: path.join(__dirname, "../public/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    autoHideMenuBar: true,
  });

  // Permissões nativas para WebRTC
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = [
      "media",
      "mediaKeySystem",
      "display-capture",
      "notifications",
      "fullscreen",
    ];

    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  session.defaultSession.setPermissionCheckHandler(() => true);

  // Captura de telas nativa para compartilhamento no Electron
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer
      .getSources({ types: ["screen", "window"] })
      .then((sources) => {
        if (sources.length > 0) {
          callback({ video: sources[0], audio: "loopback" });
        } else {
          callback({});
        }
      })
      .catch(() => callback({}));
  });

  const startUrl = process.env.ELECTRON_START_URL || SERVER_URL;

  await waitForServer(startUrl);
  mainWindow.loadURL(startUrl);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Handler IPC: Verificação restrita de status de Master/Dono para o React
ipcMain.handle("check-master-status", async () => {
  return verifyLocalMasterStatus();
});

// Handler IPC: Copiar com segurança no desktop / .exe
ipcMain.handle("copy-to-clipboard", async (event, text) => {
  try {
    if (typeof text === "string") {
      clipboard.writeText(text);
      return true;
    }
    return false;
  } catch (err) {
    console.error("Erro ao copiar para a área de transferência no Electron:", err);
    return false;
  }
});

// Handler IPC: Abrir links externos (WhatsApp, etc) no navegador padrão do Windows
ipcMain.handle("open-external", async (event, url) => {
  try {
    if (url && typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  } catch (err) {
    console.error("Erro ao abrir link externo no Electron:", err);
    return false;
  }
});

// Handler IPC: Obter URL base do servidor
ipcMain.handle("get-server-url", async () => {
  return SERVER_URL;
});

// Handler IPC: Listar janelas e monitores
ipcMain.handle("get-screen-sources", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["window", "screen"],
      thumbnailSize: { width: 480, height: 270 },
    });
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }));
  } catch (err) {
    console.error("Erro ao buscar fontes de captura:", err);
    return [];
  }
});

app.whenReady().then(async () => {
  await startEmbeddedServer();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (serverProcess) {
      try {
        serverProcess.kill();
      } catch {
        // ignore
      }
    }
    app.quit();
  }
});

app.on("will-quit", () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      // ignore
    }
  }
});
