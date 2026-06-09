import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);


const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.addScope("https://www.googleapis.com/auth/drive.file");

let isSigningIn = false;
let cachedAccessToken: string | null = typeof window !== "undefined" ? localStorage.getItem("mw_google_access_token") : null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken) {
        cachedAccessToken = localStorage.getItem("mw_google_access_token");
      }
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem("mw_google_access_token");
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Không thể lấy access token từ Google Authentication.");
    }
    cachedAccessToken = credential.accessToken;
    localStorage.setItem("mw_google_access_token", cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  localStorage.removeItem("mw_google_access_token");
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

// ============================================
// Google Sheets & Drive Direct API REST Implementation
// ============================================

// Helper to check and find or create a Google Sheet by name
export async function findOrCreateSpreadsheet(name: string, headers: string[]): Promise<{ id: string; url: string; isNew: boolean }> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Chưa xác thực Google Account. Vui lòng đăng nhập lại.");
  }

  // 1. Search for existing file with this name
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    `name='${name}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  )}`;

  const searchResponse = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchResponse.ok) {
    throw new Error(`Lỗi tìm kiếm Google Sheet: ${searchResponse.statusText}`);
  }

  const searchResult = await searchResponse.json();
  if (searchResult.files && searchResult.files.length > 0) {
    const sheetId = searchResult.files[0].id;
    return {
      id: sheetId,
      url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
      isNew: false,
    };
  }

  // 2. If not found, create a new spreadsheet
  const createResponse = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: name,
      },
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Lỗi tạo Google Sheet mới: ${createResponse.statusText}`);
  }

  const newSheet = await createResponse.json();
  const spreadsheetId = newSheet.spreadsheetId;

  // 3. Initialize spreadsheet with headers
  const updateRange = "Sheet1!A1";
  const initResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [headers],
      }),
    }
  );

  if (!initResponse.ok) {
    throw new Error(`Lỗi khởi tạo hàng tiêu đề Google Sheet: ${initResponse.statusText}`);
  }

  return {
    id: spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    isNew: true,
  };
}

// Clear and Sync all registration data to sheet
export async function syncDataToSheet(spreadsheetId: string, rows: any[][]): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Chưa xác thực Google Account. Vui lòng đăng nhập lại.");
  }

  // Clear existing values from A2 to G1000
  const clearResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A2:Z1000:clear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!clearResponse.ok) {
    throw new Error(`Lỗi khi dọn dẹp dữ liệu cũ trên Google Sheet: ${clearResponse.statusText}`);
  }

  if (rows.length === 0) return; // No rows to add

  // Write new values from A2
  const writeResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A2?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!writeResponse.ok) {
    throw new Error(`Lỗi ghi dữ liệu mới lên Google Sheet: ${writeResponse.statusText}`);
  }
}

// Helper to recursively clean undefined properties from objects to avoid Firestore serialization errors
export function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)) as any;
  }
  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val !== undefined) {
          cleaned[key] = cleanUndefined(val);
        }
      }
    }
    return cleaned as T;
  }
  return obj;
}

