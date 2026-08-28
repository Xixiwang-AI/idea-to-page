"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type GlyphProps = { size?: number; className?: string };
const glyph = (character: string) =>
  function Glyph({ size = 16, className }: GlyphProps) {
    return <span className={className} style={{ fontSize: size }} aria-hidden="true">{character}</span>;
  };

const Bold = glyph("B");
const Check = glyph("✓");
const ChevronRight = glyph("›");
const Download = glyph("↓");
const FileImage = glyph("▧");
const Heading1 = glyph("H₁");
const Heading2 = glyph("H₂");
const Highlighter = glyph("▰");
const History = glyph("◷");
const ImagePlus = glyph("▧+");
const Italic = glyph("I");
const Moon = glyph("◐");
const Palette = glyph("◉");
const PanelLeftClose = glyph("◀");
const PanelLeftOpen = glyph("☷");
const PanelRightClose = glyph("»");
const PanelRightOpen = glyph("«");
const Plus = glyph("+");
const Quote = glyph("❞");
const RotateCcw = glyph("↶");
const Search = glyph("⌕");
const Settings2 = glyph("☷");
const Sparkles = glyph("✦");
const Sun = glyph("☀");
const Underline = glyph("U̲");

type Mode = "cards" | "article";
type CardSize = "1242x1660" | "1080x1440" | "1080x1920";
type ThemeName = "paper" | "cream" | "mist" | "night";
type AvatarShape = "square" | "dino" | "dog" | "circle";
type AvatarCrop = { source: string; width: number; height: number; zoom: number; x: number; y: number };
type MediaItem = { id: string; name: string; type: string; src: string };
type StoredMedia = { id: string; name: string; type: string; blob: Blob };
type SavedDraft = {
  id: string;
  content: string;
  name: string;
  handle: string;
  mode: Mode;
  avatar: string | null;
  avatarShape: AvatarShape;
  createdAt: number;
  updatedAt: number;
};

const mediaMarkerPattern = /^\[\[image:([^\]]+)\]\]$/;

function openMediaDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("idea-to-page-media", 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("media")) {
        request.result.createObjectStore("media", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function readStoredMedia() {
  const database = await openMediaDatabase();
  return new Promise<StoredMedia[]>((resolve, reject) => {
    const request = database.transaction("media", "readonly").objectStore("media").getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as StoredMedia[]);
  }).finally(() => database.close());
}

async function storeMedia(item: StoredMedia) {
  const database = await openMediaDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction("media", "readwrite").objectStore("media").put(item);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
  database.close();
}

async function deleteStoredMedia(id: string) {
  const database = await openMediaDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction("media", "readwrite").objectStore("media").delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
  database.close();
}

const DRAFTS_KEY = "idea-to-page-drafts";
const TTL_KEY = "idea-to-page-draft-ttl";
const DEFAULT_TTL = 7;

function generateId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadDrafts(): SavedDraft[] {
  try {
    const list = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? "[]");
    return Array.isArray(list)
      ? (list as SavedDraft[]).filter((draft) => draft && typeof draft.id === "string" && typeof draft.content === "string")
      : [];
  } catch {
    return [];
  }
}

function persistDrafts(list: SavedDraft[]) {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(list));
  } catch {
    // Draft storage is best-effort; a full quota should not break editing.
  }
}

function loadTtl(): number {
  const value = Number(localStorage.getItem(TTL_KEY));
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_TTL;
}

function persistTtl(days: number) {
  try {
    localStorage.setItem(TTL_KEY, String(days));
  } catch {
    // Ignore storage failures.
  }
}

function pruneExpired(list: SavedDraft[], ttlDays: number): SavedDraft[] {
  if (ttlDays <= 0) return list;
  const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000;
  return list.filter((draft) => draft.updatedAt >= cutoff);
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

const starter = `# 把今天的灵感，变成好看的内容

写作不该被排版打断。

在左边输入 Markdown，右边会实时生成适合分享的图文卡片。

## 一次创作，多处发布

一份内容，可以变成小红书图文、朋友圈长图或公众号文章。

> 好的工具应该让表达更简单，而不是增加新的工作。

## 现在就开始

调整颜色、字号与版式，然后下载你的作品。`;

const themeOptions: Array<{ id: ThemeName; label: string; color: string }> = [
  { id: "paper", label: "纯白", color: "#ffffff" },
  { id: "cream", label: "奶油", color: "#fbf4e9" },
  { id: "mist", label: "雾蓝", color: "#edf4f8" },
  { id: "night", label: "深夜", color: "#17202f" },
];

const sizeOptions: Array<{ id: CardSize; label: string; width: number; height: number }> = [
  { id: "1242x1660", label: "1242 × 1660", width: 1242, height: 1660 },
  { id: "1080x1440", label: "1080 × 1440", width: 1080, height: 1440 },
  { id: "1080x1920", label: "1080 × 1920", width: 1080, height: 1920 },
];

const ttlOptions: Array<{ id: string; label: string; days: number }> = [
  { id: "3", label: "3 天", days: 3 },
  { id: "7", label: "7 天", days: 7 },
  { id: "30", label: "30 天", days: 30 },
  { id: "forever", label: "永久", days: 0 },
];

// 把内容拆成「渲染单元」：每个非空行一个单元，空行不参与分页
// 超长的普通段落按句子聚合成约 60-70 字符的片段，让分页能在段落内部进行，
// 避免一个超长段落占满整页、导致其前后页面留下大块空白。
function splitLines(source: string) {
  const raw = source.split(/\r?\n/).filter((line) => line.trim() !== "");
  const out: string[] = [];
  for (const line of raw) {
    const trimmed = line.trim();
    const structured =
      trimmed.startsWith("# ") ||
      trimmed.startsWith("## ") ||
      trimmed.startsWith("> ") ||
      /^[-*] /.test(trimmed) ||
      mediaMarkerPattern.test(trimmed);
    if (structured || line.length <= 80) {
      out.push(line);
      continue;
    }
    const sentences = line.split(/(?<=[。！？!?；;])/).filter((s) => s.trim() !== "");
    const chunks: string[] = [];
    let buf = "";
    for (const s of sentences) {
      if (buf && (buf + s).length > 70) {
        chunks.push(buf);
        buf = s;
      } else {
        buf += s;
      }
    }
    if (buf) chunks.push(buf);
    if (chunks.length > 1) out.push(...chunks);
    else out.push(line);
  }
  return out;
}

function calcLineWeight(line: string) {
  if (mediaMarkerPattern.test(line.trim())) return 5;
  return Math.max(1, Math.ceil(line.length / 55)) + (line.startsWith("# ") ? 2 : 0);
}

// 宽松预分页：权重上限保守一些，避免单页塞太满
function paginate(source: string) {
  const lines = splitLines(source);
  if (!lines.length) return [["# 从这里开始", "写下你的第一段内容。"]];
  const pages: string[][] = [];
  let page: string[] = [];
  let weight = 0;
  lines.forEach((line) => {
    const w = calcLineWeight(line);
    if (page.length && weight + w > 22) {
      pages.push(page);
      page = [];
      weight = 0;
    }
    page.push(line);
    weight += w;
  });
  if (page.length) pages.push(page);
  return pages;
}

// 草稿列表里预估页数（仅用于展示，不参与实际分页）
function estimatePageCount(source: string) {
  const lines = splitLines(source);
  let pages = 0;
  let weight = 0;
  let hasContent = false;
  lines.forEach((line) => {
    const w = calcLineWeight(line);
    if (hasContent && weight + w > 22) {
      pages += 1;
      weight = 0;
    }
    weight += w;
    hasContent = true;
  });
  if (hasContent) pages += 1;
  return pages;
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(<u>[^<]+<\/u>|\*\*[^*]+\*\*|\*[^*]+\*|==[^=]+==)/g);
  return parts.map((part, index) => {
    if (part.startsWith("<u>") && part.endsWith("</u>")) return <u key={index}>{part.slice(3, -4)}</u>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("==") && part.endsWith("==")) return <mark key={index}>{part.slice(2, -2)}</mark>;
    return part;
  });
}

function MarkdownBlocks({ blocks, media }: { blocks: string[]; media: MediaItem[] }) {
  return blocks.flatMap((block, blockIndex) =>
    block.split("\n").map((line, lineIndex) => {
      const key = `${blockIndex}-${lineIndex}`;
      const mediaMatch = line.trim().match(mediaMarkerPattern);
      if (mediaMatch) {
        const item = media.find((candidate) => candidate.id === mediaMatch[1]);
        if (!item) return <div className="content-image-missing" key={key}>图片暂不可用，请重新添加</div>;
        return (
          <figure className="content-image" key={key}>
            <img src={item.src} alt={item.name} />
          </figure>
        );
      }
      if (line.startsWith("# ")) return <h3 key={key}><InlineText text={line.slice(2)} /></h3>;
      if (line.startsWith("## ")) return <h4 key={key}><InlineText text={line.slice(3)} /></h4>;
      if (line.startsWith("> ")) return <blockquote key={key}><InlineText text={line.slice(2)} /></blockquote>;
      if (/^[-*] /.test(line)) return <p className="bullet" key={key}><span>•</span><InlineText text={line.slice(2)} /></p>;
      return <p key={key}><InlineText text={line} /></p>;
    }),
  );
}

export default function Home() {
  const [content, setContent] = useState(starter);
  const [mode, setMode] = useState<Mode>("cards");
  const [dark, setDark] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [name, setName] = useState("灵感笔记");
  const [handle, setHandle] = useState("@ideatopage");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarShape, setAvatarShape] = useState<AvatarShape>("circle");
  const [avatarCrop, setAvatarCrop] = useState<AvatarCrop | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [accent, setAccent] = useState("#2563eb");
  const [theme, setTheme] = useState<ThemeName>("paper");
  const [fontSize, setFontSize] = useState(17);
  const [lineHeight, setLineHeight] = useState(1.75);
  const [cardPadding, setCardPadding] = useState(38);
  const [cardSize, setCardSize] = useState<CardSize>("1080x1440");
  const [previewOpen, setPreviewOpen] = useState(true);
  const [toast, setToast] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [ttlDays, setTtlDays] = useState(DEFAULT_TTL);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const currentDraftIdRef = useRef<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const cropDragRef = useRef<{ pointerId: number; clientX: number; clientY: number; x: number; y: number } | null>(null);
  const [pages, setPages] = useState<string[][]>(() => paginate(starter));
  const visiblePages = mode === "article" ? [pages.flat()] : pages;
  const activeTheme = themeOptions.find((option) => option.id === theme)!;
  const activeSize = sizeOptions.find((option) => option.id === cardSize)!;
  const cardInk = theme === "night" ? "#f7f8fb" : "#1a2433";
  const avatarLetter = name.trim().slice(0, 1) || "灵";
  const cropViewport = 280;
  const cropBaseScale = avatarCrop ? Math.max(cropViewport / avatarCrop.width, cropViewport / avatarCrop.height) : 1;
  const cropWidth = avatarCrop ? avatarCrop.width * cropBaseScale * avatarCrop.zoom : cropViewport;
  const cropHeight = avatarCrop ? avatarCrop.height * cropBaseScale * avatarCrop.zoom : cropViewport;
  const cropPanX = Math.max(0, (cropWidth - cropViewport) / 2);
  const cropPanY = Math.max(0, (cropHeight - cropViewport) / 2);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };

  const markCurrentDraft = (id: string | null) => {
    currentDraftIdRef.current = id;
    setCurrentDraftId(id);
  };

  useEffect(() => {
    try {
      const savedTtl = loadTtl();
      setTtlDays(savedTtl);

      let list = loadDrafts();
      let changed = false;

      // 迁移旧版单份草稿（idea-to-page-draft）到草稿箱
      const legacyRaw = localStorage.getItem("idea-to-page-draft");
      if (legacyRaw) {
        try {
          const legacy = JSON.parse(legacyRaw);
          if (legacy && typeof legacy.content === "string" && legacy.content.trim()) {
            const exists = list.some((draft) => draft.content === legacy.content);
            if (!exists) {
              const now = Date.now();
              const legacyShape = (["square", "dino", "dog", "circle"] as AvatarShape[]).includes(legacy.avatarShape)
                ? legacy.avatarShape as AvatarShape
                : "circle";
              list = [{
                id: generateId(),
                content: legacy.content,
                name: legacy.name ?? "灵感笔记",
                handle: legacy.handle ?? "@ideatopage",
                mode: legacy.mode === "article" ? "article" : "cards",
                avatar: legacy.avatar ?? null,
                avatarShape: legacyShape,
                createdAt: now,
                updatedAt: now,
              }, ...list];
              changed = true;
            }
          }
        } catch {
          // Ignore damaged legacy draft.
        }
        localStorage.removeItem("idea-to-page-draft");
      }

      const pruned = pruneExpired(list, savedTtl);
      if (pruned.length !== list.length) changed = true;
      list = pruned.sort((a, b) => b.updatedAt - a.updatedAt);
      if (changed) persistDrafts(list);

      setDrafts(list);

      if (list.length > 0) {
        const latest = list[0];
        setContent(latest.content);
        setName(latest.name);
        setHandle(latest.handle);
        setMode(latest.mode);
        setAvatar(latest.avatar);
        setAvatarShape(latest.avatarShape);
        markCurrentDraft(latest.id);
      }
    } catch {
      // A damaged local draft should never prevent opening the editor.
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    readStoredMedia()
      .then((items) => setMedia(items.map((item) => ({ ...item, src: URL.createObjectURL(item.blob) }))))
      .catch(() => notify("本地图片记录读取失败，可重新添加图片"));
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      const id = currentDraftIdRef.current ?? generateId();
      const now = Date.now();
      const current = loadDrafts();
      const existing = current.find((draft) => draft.id === id);
      const entry: SavedDraft = {
        id,
        content,
        name,
        handle,
        mode,
        avatar,
        avatarShape,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const next = [entry, ...current.filter((draft) => draft.id !== id)].sort((a, b) => b.updatedAt - a.updatedAt);
      setDrafts(next);
      persistDrafts(next);
      if (!currentDraftIdRef.current) markCurrentDraft(id);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [avatar, avatarShape, content, draftReady, handle, mode, name]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (settingsPanelRef.current?.contains(target)) return;
      if (settingsButtonRef.current?.contains(target)) return;
      setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [settingsOpen]);

  // content 变化时：行数不变则保留分页结构只更新文字；行数变化才重新分页
  useEffect(() => {
    const lines = splitLines(content);
    setPages((current) => {
      const currentLines = current.flat();
      if (currentLines.length === lines.length) {
        let i = 0;
        return current.map((page) => page.map(() => lines[i++]));
      }
      return paginate(content);
    });
  }, [content]);

  // 渲染后同步测量：溢出时把最后一行移到下一页；不足时尝试从下一页移回
  useLayoutEffect(() => {
    if (mode === "article" || !previewOpen) return;
    const container = cardContainerRef.current;
    if (!container) return;
    const cards = Array.from(container.querySelectorAll<HTMLElement>(".share-card"));

    // 第一步：消除溢出。flex 容器里 scrollHeight 不可靠，用真实布局位置判断。
    for (let index = 0; index < cards.length; index += 1) {
      const copy = cards[index].querySelector<HTMLElement>(".card-copy");
      const lastChild = copy?.lastElementChild as HTMLElement | null;
      if (!copy || !lastChild) continue;
      const copyRect = copy.getBoundingClientRect();
      const lastRect = lastChild.getBoundingClientRect();
      if (lastRect.bottom > copyRect.bottom + 1) {
        setPages((current) => {
          const next = current.map((page) => [...page]);
          const page = next[index];
          if (!page || page.length <= 1) return current;
          const moved = page.pop()!;
          if (index + 1 < next.length) next[index + 1].unshift(moved);
          else next.push([moved]);
          return next;
        });
        return;
      }
    }

    // 第二步：填充空白。测量下一页第一行「连同其后间距」的真实占用，
    // 只有本页剩余空白放得下才移回，避免移回后溢出导致的来回振荡。
    for (let index = 0; index < cards.length; index += 1) {
      const copy = cards[index].querySelector<HTMLElement>(".card-copy");
      if (!copy || index + 1 >= cards.length) continue;
      const lastChild = copy.lastElementChild as HTMLElement | null;
      if (!lastChild) continue;
      const copyRect = copy.getBoundingClientRect();
      const lastRect = lastChild.getBoundingClientRect();
      const slack = copyRect.bottom - lastRect.bottom;

      const nextCopy = cards[index + 1].querySelector<HTMLElement>(".card-copy");
      const nextFirst = nextCopy?.firstElementChild as HTMLElement | null;
      if (!nextFirst) continue;
      const nextFirstTop = nextFirst.getBoundingClientRect().top;
      const nextSecond = nextFirst.nextElementSibling as HTMLElement | null;
      // 占用 = 该行高度 + 它与下一行之间的间距；若它是下一页唯一元素，则用自身高度并预留行间距
      const occupy = nextSecond
        ? nextSecond.getBoundingClientRect().top - nextFirstTop
        : nextFirst.getBoundingClientRect().height + 10;
      if (slack < occupy + 2) continue;

      setPages((current) => {
        const next = current.map((page) => [...page]);
        const nextPage = next[index + 1];
        if (!nextPage || !nextPage.length) return current;
        const moved = nextPage.shift()!;
        if (moved.startsWith("# ") || moved.startsWith("## ")) {
          nextPage.unshift(moved);
          return current;
        }
        next[index].push(moved);
        return next;
      });
      return;
    }
  }, [pages, previewOpen, mode]);

  const wrapSelection = (before: string, after = before) => {
    const editor = editorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = content.slice(start, end) || "文字";
    const next = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(next);
    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const prefixLine = (prefix: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const start = content.lastIndexOf("\n", editor.selectionStart - 1) + 1;
    setContent(content.slice(0, start) + prefix + content.slice(start));
    window.requestAnimationFrame(() => editor.focus());
  };

  const changeAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("请选择图片文件");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      notify("头像请控制在 12MB 以内");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => notify("头像读取失败，请换一张图片试试");
    reader.onload = () => {
      const source = String(reader.result);
      const image = new Image();
      image.onerror = () => notify("头像读取失败，请换一张图片试试");
      image.onload = () => {
        setAvatarCrop({ source, width: image.naturalWidth, height: image.naturalHeight, zoom: 1, x: 0, y: 0 });
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  };

  const moveAvatarCrop = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = cropDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !avatarCrop) return;
    const nextX = cropPanX ? Math.max(-100, Math.min(100, drag.x + ((event.clientX - drag.clientX) / cropPanX) * 100)) : 0;
    const nextY = cropPanY ? Math.max(-100, Math.min(100, drag.y + ((event.clientY - drag.clientY) / cropPanY) * 100)) : 0;
    setAvatarCrop((current) => current ? { ...current, x: nextX, y: nextY } : current);
  };

  const finishAvatarCropDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (cropDragRef.current?.pointerId === event.pointerId) cropDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const applyAvatarCrop = () => {
    if (!avatarCrop || !cropImageRef.current) return;
    const size = 720;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      notify("头像处理失败，请重试");
      return;
    }
    const baseScale = Math.max(size / avatarCrop.width, size / avatarCrop.height);
    const width = avatarCrop.width * baseScale * avatarCrop.zoom;
    const height = avatarCrop.height * baseScale * avatarCrop.zoom;
    const maxX = Math.max(0, (width - size) / 2);
    const maxY = Math.max(0, (height - size) / 2);
    const left = (size - width) / 2 + (avatarCrop.x / 100) * maxX;
    const top = (size - height) / 2 + (avatarCrop.y / 100) * maxY;
    context.drawImage(cropImageRef.current, left, top, width, height);
    setAvatar(canvas.toDataURL("image/jpeg", 0.92));
    setAvatarCrop(null);
    notify("头像范围已应用");
  };

  const removeAvatar = () => {
    setAvatar(null);
    notify("已恢复默认头像");
  };

  const chooseAvatarShape = (shape: AvatarShape) => {
    setAvatarShape(shape);
    const shapeLabel = shape === "square" ? "方形" : shape === "dino" ? "小恐龙" : shape === "dog" ? "小狗" : "圆形";
    notify(`已切换为${shapeLabel}头像`);
  };

  const insertMediaMarker = (id: string) => {
    const editor = editorRef.current;
    const position = editor?.selectionStart ?? content.length;
    const marker = `\n\n[[image:${id}]]\n\n`;
    setContent((current) => current.slice(0, position) + marker + current.slice(position));
    window.requestAnimationFrame(() => {
      editor?.focus();
      editor?.setSelectionRange(position + marker.length, position + marker.length);
    });
  };

  const addMedia = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const invalid = files.find((file) => !file.type.startsWith("image/"));
    if (invalid) {
      notify("请选择图片或 GIF 文件");
      return;
    }
    if (files.some((file) => file.size > 15 * 1024 * 1024)) {
      notify("单张图片请控制在 15MB 以内");
      return;
    }

    try {
      const added: MediaItem[] = [];
      for (const file of files) {
        const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await storeMedia({ id, name: file.name, type: file.type, blob: file });
        added.push({ id, name: file.name, type: file.type, src: URL.createObjectURL(file) });
      }
      setMedia((current) => [...current, ...added]);
      added.forEach((item) => insertMediaMarker(item.id));
      notify(added.some((item) => item.type === "image/gif") ? "动态图片已添加" : `${added.length} 张图片已添加`);
    } catch {
      notify("图片保存失败，请换一张较小的图片试试");
    }
  };

  const removeMedia = async (item: MediaItem) => {
    setMedia((current) => current.filter((candidate) => candidate.id !== item.id));
    setContent((current) => current.replace(new RegExp(`\\n*\\[\\[image:${item.id}\\]\\]\\n*`, "g"), "\n\n"));
    URL.revokeObjectURL(item.src);
    await deleteStoredMedia(item.id).catch(() => undefined);
    notify("图片已移除");
  };

  const download = async () => {
    const cards = Array.from(cardContainerRef.current?.querySelectorAll<HTMLElement>(".share-card") ?? []);
    if (!cards.length) return;
    notify("正在生成高清图片…");
    const { toPng } = await import("html-to-image");
    for (let index = 0; index < cards.length; index += 1) {
      const dataUrl = await toPng(cards[index], mode === "cards"
        ? { cacheBust: true, pixelRatio: 1, canvasWidth: activeSize.width, canvasHeight: activeSize.height }
        : { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `灵感成页-${String(index + 1).padStart(2, "0")}.png`;
      link.href = dataUrl;
      link.click();
    }
    notify(cards.length > 1 ? `已生成 ${cards.length} 张图片` : "图片已下载");
  };

  const resetProject = () => {
    const id = generateId();
    const now = Date.now();
    const entry: SavedDraft = {
      id,
      content: "# 新的灵感\n\n从这里开始写作。",
      name: "灵感笔记",
      handle: "@ideatopage",
      mode: "cards",
      avatar: null,
      avatarShape: "circle",
      createdAt: now,
      updatedAt: now,
    };
    const next = [entry, ...drafts].sort((a, b) => b.updatedAt - a.updatedAt);
    setDrafts(next);
    persistDrafts(next);
    setContent(entry.content);
    setName(entry.name);
    setHandle(entry.handle);
    setMode(entry.mode);
    setAvatar(entry.avatar);
    setAvatarShape(entry.avatarShape);
    markCurrentDraft(id);
    notify("已新建空白作品");
  };

  const loadDraft = (id: string) => {
    const draft = drafts.find((candidate) => candidate.id === id);
    if (!draft) return;
    setContent(draft.content);
    setName(draft.name);
    setHandle(draft.handle);
    setMode(draft.mode);
    setAvatar(draft.avatar);
    setAvatarShape(draft.avatarShape);
    markCurrentDraft(id);
    setHistoryOpen(false);
    notify("已恢复草稿");
  };

  const deleteDraft = (id: string) => {
    const next = drafts.filter((draft) => draft.id !== id);
    setDrafts(next);
    persistDrafts(next);
    if (currentDraftIdRef.current === id) markCurrentDraft(null);
    notify("草稿已删除");
  };

  const changeTtl = (days: number) => {
    setTtlDays(days);
    persistTtl(days);
    const pruned = pruneExpired(drafts, days);
    if (pruned.length !== drafts.length) {
      setDrafts(pruned);
      persistDrafts(pruned);
    }
    notify(days === 0 ? "草稿将永久保留" : `草稿将保留 ${days} 天`);
  };

  return (
    <main className={`app${dark ? " dark" : ""}${previewOpen ? "" : " preview-collapsed"}`}>
      <aside className={historyOpen ? "history-sidebar open" : "history-sidebar"} aria-label="草稿箱">
        {!historyOpen && (
          <button className="history-tab" aria-label="打开草稿箱" onClick={() => setHistoryOpen(true)}>
            <PanelLeftOpen size={18} />
          </button>
        )}
        <div className="history-drawer">
          <div className="history-head">
            <span><History size={16} />草稿箱</span>
            <button className="mini-icon" aria-label="收起草稿箱" onClick={() => setHistoryOpen(false)}><PanelLeftClose size={17} /></button>
          </div>
          <p>自动保存在当前设备</p>
          <div className="draft-ttl">
            <span>保留时长</span>
            <div className="draft-ttl-options">
              {ttlOptions.map((option) => (
                <button key={option.id} type="button" className={ttlDays === option.days ? "active" : ""} aria-pressed={ttlDays === option.days} onClick={() => changeTtl(option.days)}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="draft-list">
            {drafts.length === 0 ? (
              <p className="draft-empty">暂无草稿，开始写作后会自动保存</p>
            ) : (
              drafts.map((draft) => (
                <div className={draft.id === currentDraftId ? "history-card current" : "history-card"} key={draft.id}>
                  <button className="history-card-main" type="button" onClick={() => loadDraft(draft.id)}>
                    <span className="history-type">{draft.mode === "article" ? "长文" : "图文"}</span>
                    <strong>{draft.content.match(/^# (.+)$/m)?.[1] ?? "未命名作品"}</strong>
                    <small>{formatRelativeTime(draft.updatedAt)} · {estimatePageCount(draft.content)} 页</small>
                  </button>
                  <button className="draft-delete" type="button" aria-label="删除草稿" onClick={() => deleteDraft(draft.id)}>×</button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      <section className="editor-panel">
        <header className="brand-row">
          <div className="brand-title">
            <h1>灵感成页</h1>
            <p className="brand-en">IDEA TO PAGE</p>
            <span className="subtle">{mode === "cards" ? `${pages.length} 张图片` : "1 篇长文"}</span>
          </div>
          <div className="segmented" aria-label="内容模式">
            <button className={mode === "cards" ? "active" : ""} onClick={() => setMode("cards")}>图文卡片</button>
            <button className={mode === "article" ? "active" : ""} onClick={() => setMode("article")}>长文</button>
          </div>
          <div className="brand-actions">
            <button className="square" aria-label="新建作品" title="新建作品" onClick={resetProject}><Plus size={18} /></button>
            <button className="square" aria-label="切换主题" title="切换界面主题" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="square" aria-label={previewOpen ? "收起预览" : "打开预览"} title={previewOpen ? "收起预览" : "打开预览"} onClick={() => setPreviewOpen(!previewOpen)}>{previewOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}</button>
          </div>
        </header>

        <section className="editor-controls">
          {mode === "cards" && (
            <>
            <div className="profile-row">
              <button
                className={`avatar avatar-upload avatar-${avatarShape}`}
                type="button"
                aria-label="更换头像"
                title="点击更换头像"
                onClick={() => avatarInputRef.current?.click()}
              >
                {avatar ? <img src={avatar} alt="" /> : avatarLetter}
                <span className="avatar-edit-badge">更换</span>
              </button>
              <input
                ref={avatarInputRef}
                className="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={changeAvatar}
              />
              <input aria-label="名称" value={name} onChange={(event) => setName(event.target.value)} />
              <input aria-label="账号" value={handle} onChange={(event) => setHandle(event.target.value)} />
              <button
                className="tool-button"
                type="button"
                aria-label={avatar ? "恢复默认头像" : "选择头像"}
                title={avatar ? "恢复默认头像" : "选择头像"}
                onClick={avatar ? removeAvatar : () => avatarInputRef.current?.click()}
              >
                {avatar ? <RotateCcw size={16} /> : <ImagePlus size={16} />}
              </button>
            </div>
            <div className="avatar-shape-picker" role="group" aria-label="头像形状">
              <span className="avatar-shape-label">头像形状</span>
              {([
                ["square", "方形"],
                ["dino", "小恐龙"],
                ["dog", "小狗"],
                ["circle", "圆形"],
              ] as Array<[AvatarShape, string]>).map(([shape, label]) => (
                <button
                  key={shape}
                  className={avatarShape === shape ? "avatar-shape-option selected" : "avatar-shape-option"}
                  type="button"
                  aria-pressed={avatarShape === shape}
                  onClick={() => chooseAvatarShape(shape)}
                >
                  <span className={`avatar-shape-sample avatar-${shape}`} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
            </>
          )}

          <div className="toolbar" aria-label="文字样式">
            <button className="tool-button" title="一级标题" onClick={() => prefixLine("# ")}><Heading1 /></button>
            <button className="tool-button" title="二级标题" onClick={() => prefixLine("## ")}><Heading2 /></button>
            <button className="tool-button" title="加粗" onClick={() => wrapSelection("**")}><Bold /></button>
            <button className="tool-button" title="斜体" onClick={() => wrapSelection("*")}><Italic /></button>
            <button className="tool-button" title="下划线" onClick={() => wrapSelection("<u>", "</u>")}><Underline /></button>
            <button className="tool-button" title="重点引用" onClick={() => prefixLine("> ")}><Quote /></button>
            <button className="tool-button" title="高亮" onClick={() => wrapSelection("==")}><Highlighter /></button>
            <button className="tool-button" title="插入图片或 GIF" onClick={() => mediaInputRef.current?.click()}><ImagePlus /></button>
            <input ref={mediaInputRef} className="visually-hidden" type="file" accept="image/*,.gif" multiple onChange={addMedia} />
            <button className="tool-button" title="查找" onClick={() => { editorRef.current?.focus(); notify("可使用 ⌘F 在编辑器内查找"); }}><Search /></button>
            <button ref={settingsButtonRef} className={settingsOpen ? "tool-button active" : "tool-button"} title="设计设置" onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 /></button>
          </div>

          {media.length > 0 && (
            <div className="media-strip" aria-label="已添加图片">
              <span>已添加</span>
              {media.map((item) => (
                <div className="media-chip" key={item.id}>
                  <button className="media-insert" type="button" title="再次插入到光标处" onClick={() => insertMediaMarker(item.id)}>
                    <img src={item.src} alt="" />
                    {item.type === "image/gif" && <b>GIF</b>}
                  </button>
                  <button className="media-remove" type="button" aria-label={`移除 ${item.name}`} onClick={() => removeMedia(item)}>×</button>
                </div>
              ))}
            </div>
          )}

          {settingsOpen && (
            <div className="settings-panel" ref={settingsPanelRef}>
              <div className="settings-title"><span><Palette size={16} />卡片设计</span><small>实时生效</small></div>
              <label>强调色<input type="color" value={accent} onChange={(event) => setAccent(event.target.value)} /></label>
              <label>字号<input type="range" min="14" max="22" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /><b>{fontSize}</b></label>
              <label>行距<input type="range" min="1.4" max="2.1" step=".05" value={lineHeight} onChange={(event) => setLineHeight(Number(event.target.value))} /><b>{lineHeight}</b></label>
              <label>页边距<input type="range" min="20" max="64" step="2" value={cardPadding} onChange={(event) => setCardPadding(Number(event.target.value))} /><b>{cardPadding}</b></label>
              {mode === "cards" && (
                <div className="size-control">
                  <span className="size-label">图片尺寸</span>
                  <div className="size-options">
                    {sizeOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={cardSize === option.id ? "selected" : ""}
                        aria-pressed={cardSize === option.id}
                        onClick={() => { setCardSize(option.id); notify(`已切换为 ${option.label}`); }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="theme-swatches">
                {themeOptions.map((option) => (
                  <button key={option.id} className={theme === option.id ? "selected" : ""} onClick={() => setTheme(option.id)} title={option.label}>
                    <span style={{ background: option.color }} />{theme === option.id && <Check size={12} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="editor-wrap">
          <textarea
            ref={editorRef}
            className="editor"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            spellCheck={false}
            aria-label="Markdown 编辑器"
          />
          <div className="editor-status"><span><Check size={12} />已自动保存</span><span>{content.replace(/\s/g, "").length} 字</span></div>
        </div>
      </section>

      <section className="preview-panel">
        {previewOpen && (
          <>
            <header className="preview-topbar">
              <div>
                <h2>预览与下载</h2>
                <span className="subtle">{mode === "cards" ? "自动分页已开启" : "公众号长文样式"}</span>
              </div>
              <div className="topbar-actions">
                <button className="secondary" onClick={() => { setContent(starter); notify("示例内容已恢复"); }}><RotateCcw size={16} />恢复示例</button>
                <button className="primary" onClick={download}><Download size={17} />{mode === "cards" && pages.length > 1 ? "批量下载" : "下载图片"}</button>
              </div>
            </header>

            <div className={mode === "article" ? "preview-stage article-stage" : "preview-stage"} ref={cardContainerRef}>
              <div className="pages">
                {visiblePages.map((page, index) => (
                  <article
                    className={mode === "article" ? "share-card article-card" : "share-card"}
                    key={index}
                    style={{
                      "--card-bg": activeTheme.color,
                      "--card-ink": cardInk,
                      "--card-accent": accent,
                      "--copy-size": `${fontSize}px`,
                      "--copy-leading": lineHeight,
                      padding: mode === "article" ? `${cardPadding + 14}px ${cardPadding + 20}px` : `${cardPadding}px`,
                      aspectRatio: mode === "article" ? undefined : `${activeSize.width} / ${activeSize.height}`,
                    } as React.CSSProperties}
                  >
                    <div className="card-profile">
                      <div className={`avatar avatar-${avatarShape}`}>{avatar ? <img src={avatar} alt="" /> : avatarLetter}</div>
                      <div><strong>{name || "未命名"}</strong><span>{handle || "@yourname"}</span></div>
                      <Sparkles className="profile-mark" size={17} />
                    </div>
                    <div className="card-copy"><MarkdownBlocks blocks={page} media={media} /></div>
                    <footer><span>IDEA TO PAGE</span><span>{String(index + 1).padStart(2, "0")} / {String(visiblePages.length).padStart(2, "0")}</span></footer>
                  </article>
                ))}
              </div>
              {mode === "cards" && (
                <aside className="preview-note">
                  <FileImage size={18} />
                  <div><strong>高清 PNG</strong><span>{activeSize.label}</span></div>
                  <ChevronRight size={16} />
                </aside>
              )}
            </div>
          </>
        )}
      </section>

      {avatarCrop && (
        <div className="avatar-crop-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAvatarCrop(null); }}>
          <section className="avatar-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
            <header>
              <div><h2 id="avatar-crop-title">选择头像范围</h2><p>拖动照片选择人物位置，滑动下方控制缩放</p></div>
              <button type="button" aria-label="取消头像裁剪" onClick={() => setAvatarCrop(null)}>×</button>
            </header>
            <div
              className={`avatar-crop-viewport avatar-${avatarShape}`}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                cropDragRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: avatarCrop.x, y: avatarCrop.y };
              }}
              onPointerMove={moveAvatarCrop}
              onPointerUp={finishAvatarCropDrag}
              onPointerCancel={finishAvatarCropDrag}
            >
              <img
                ref={cropImageRef}
                src={avatarCrop.source}
                alt="头像裁剪预览"
                draggable={false}
                style={{
                  width: cropWidth,
                  height: cropHeight,
                  left: (cropViewport - cropWidth) / 2 + (avatarCrop.x / 100) * cropPanX,
                  top: (cropViewport - cropHeight) / 2 + (avatarCrop.y / 100) * cropPanY,
                }}
              />
              <span>拖动照片调整范围</span>
            </div>
            <label className="avatar-crop-zoom">缩放<input type="range" min="1" max="3" step="0.01" value={avatarCrop.zoom} onChange={(event) => setAvatarCrop((current) => current ? { ...current, zoom: Number(event.target.value), x: Math.max(-100, Math.min(100, current.x)), y: Math.max(-100, Math.min(100, current.y)) } : current)} /><b>{Math.round(avatarCrop.zoom * 100)}%</b></label>
            <div className="avatar-crop-actions">
              <button className="secondary" type="button" onClick={() => setAvatarCrop(null)}>取消</button>
              <button className="primary" type="button" onClick={applyAvatarCrop}>使用此范围</button>
            </div>
          </section>
        </div>
      )}

      <div className={toast ? "toast show" : "toast"} aria-live="polite"><Check size={15} />{toast}</div>
    </main>
  );
}
