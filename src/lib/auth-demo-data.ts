export type AuthUser = {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  role: string;
  appRole?: string;
  initial: string;
  authSource?: "demo" | "supabase";
};

export const demoUsers: AuthUser[] = [
  {
    id: "user-owner-yamada",
    name: "山田 太郎",
    email: "yamada@example.com",
    department: "営業本部",
    position: "本部長",
    role: "Owner",
    initial: "山",
  },
  {
    id: "user-approver-sato",
    name: "佐藤 一郎",
    email: "sato@example.com",
    department: "買取営業",
    position: "部門長",
    role: "Manager",
    initial: "佐",
  },
  {
    id: "user-editor-suzuki",
    name: "鈴木 太郎",
    email: "suzuki@example.com",
    department: "情シス",
    position: "管理者",
    role: "Admin",
    initial: "鈴",
  },
  {
    id: "user-viewer-tanaka",
    name: "田中 美咲",
    email: "tanaka@example.com",
    department: "総務部",
    position: "担当者",
    role: "Member",
    initial: "田",
  },
];
