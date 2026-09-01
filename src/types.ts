export interface VipPermissions {
  canUseGifAvatar: boolean;
  canUseVideoMp4Banner: boolean;
  canEditAdvancedProfile: boolean;
  hasVipBadge: boolean;
  grantedAt: number;
  expiresAt: number | null; // null = until call ends or permanent
  grantedBy: string;
}

export interface Participant {
  id: string; // socket id
  name: string;
  tag?: string; // e.g. "4921"
  isHost: boolean;
  isMaster?: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  isScreenSharing: boolean;
  isDeafened: boolean;
  isMutedByHost: boolean;
  avatarColor: string;
  avatarEmoji?: string;
  avatarUrl?: string; // Real uploaded profile picture or GIF/MP4
  bannerColor?: string;
  bannerUrl?: string; // Uploaded profile banner or MP4 video loop
  customStatus?: string; // e.g. "Dono Master", "Disponível"
  bio?: string;
  badges?: string[]; // Array of badge IDs equipped
  customTitle?: string; // Custom Store title (e.g. "Streamer Pro", "Elite Gamer")
  kokiCoins?: number; // User currency balance
  purchasedPerks?: Record<string, number>; // perkId -> activeUntil timestamp (ms)
  vipPermissions?: VipPermissions; // VIP privileges granted by the Owner
  joinedAt: number;
  audioLevel?: number; // 0 to 100 for speaking indicator
  stream?: MediaStream;
  screenStream?: MediaStream;
  userVolume?: number; // local volume adjustment for this participant (0 to 200)
  voiceChannelId?: string; // "voice-geral" or "voice-vip"
}

export interface KnockRequest {
  socketId: string;
  name: string;
  tag: string;
  avatarEmoji?: string;
  avatarColor?: string;
  avatarUrl?: string;
  customStatus?: string;
  requestedAt: number;
}

export interface TextChannel {
  id: string;
  name: string;
  description: string;
  icon?: string;
  unreadCount?: number;
}

export interface RoomSettings {
  allowScreenShare: boolean;
  allowVideo: boolean;
  allowGuestChat: boolean;
  maxParticipants: number;
  lowBandwidthDefault: boolean;
  requireKnockApproval: boolean; // Owner admission gatekeeper
}

export interface RoomState {
  roomId: string;
  roomName: string;
  hostSocketId: string;
  isLocked: boolean;
  createdAt: number;
  channels: TextChannel[];
  settings: RoomSettings;
  participants: Participant[];
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatarEmoji?: string;
  senderAvatarColor?: string;
  senderAvatarUrl?: string;
  senderIsHost?: boolean;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  isSecurityWarning?: boolean;
}

export type VideoQuality = 'low' | 'medium' | 'high';

export interface UserPreferences {
  name: string;
  selectedAudioInput: string;
  selectedAudioOutput: string;
  selectedVideoInput: string;
  isPushToTalk: boolean;
  pushToTalkKey: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  lowResourceMode: boolean; // Disables video rendering to save CPU/GPU for gaming
  videoQuality: VideoQuality;
  volume: number;
}

export interface SavedUserProfile {
  name: string;
  tag: string;
  avatarEmoji: string;
  avatarColor: string;
  avatarUrl?: string; // Owner or VIP photo/GIF
  bannerColor: string;
  bannerUrl?: string; // Video MP4, GIF or image
  customStatus: string;
  bio: string;
  customTitle?: string;
  badges?: string[];
  kokiCoins?: number;
  purchasedPerks?: Record<string, number>; // perkId -> activeUntil timestamp in ms
  rememberLogin: boolean;
}

export type StorePerkId = 'gif_avatar' | 'custom_banner' | 'custom_title' | 'vip_role';

export interface StorePerk {
  id: StorePerkId;
  name: string;
  tagline: string;
  description: string;
  price: number; // in Koki Coins
  durationHours: number; // 72 hours
  iconName: string;
  themeColor: string;
  badgeLabel: string;
  benefits: string[];
}

export interface PurchasedPerkState {
  perkId: StorePerkId;
  activeUntil: number;
  isActive: boolean;
  remainingMs: number;
  formattedRemaining: string;
}

export interface MasterAuthStatus {
  isMaster: boolean;
  masterToken?: string | null;
  machineId?: string;
  username?: string;
  hostname?: string;
  authMethod?: "owner_key" | "env_secret" | "machine_id" | "none";
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      getScreenSources: () => Promise<Array<{ id: string; name: string; thumbnail: string }>>;
      checkMasterStatus: () => Promise<MasterAuthStatus>;
      copyToClipboard?: (text: string) => Promise<boolean>;
      openExternal?: (url: string) => Promise<boolean>;
      getServerUrl?: () => Promise<string>;
    };
  }
}
