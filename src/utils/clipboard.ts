/**
 * Safe clipboard copy supporting both Web browsers (navigator.clipboard / execCommand fallback)
 * and Electron Desktop .exe (via ipcRenderer / window.electronAPI).
 */
export async function copyToClipboardSafe(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try Electron native clipboard API first if running in desktop app
  if (typeof window !== "undefined" && window.electronAPI?.copyToClipboard) {
    try {
      const ok = await window.electronAPI.copyToClipboard(text);
      if (ok) return true;
    } catch {
      // fallback
    }
  }

  // 2. Try standard navigator.clipboard
  if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback to legacy textarea method
    }
  }

  // 3. Fallback textarea execCommand copy (works everywhere even in non-secure or older contexts)
  if (typeof document !== "undefined") {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.opacity = "0";
      textArea.style.pointerEvents = "none";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Safe external URL opener supporting both Web (window.open) and Electron Desktop (shell.openExternal).
 */
export function openExternalSafe(url: string): void {
  if (!url) return;

  if (typeof window !== "undefined" && window.electronAPI?.openExternal) {
    try {
      window.electronAPI.openExternal(url);
      return;
    } catch {
      // fallback
    }
  }

  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
