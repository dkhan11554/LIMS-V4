import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getCurrentUserOrThrow } from "./users.ts";

async function nextDocNumber(ctx: Parameters<typeof getCurrentUserOrThrow>[0], labId: string): Promise<string> {
  const existing = await ctx.db.query("documents").withIndex("by_laboratory", (q) => q.eq("laboratoryId", labId as Parameters<typeof q.eq>[1])).collect();
  return `DOC-${String(existing.length + 1).padStart(5, "0")}`;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    return await ctx.storage.generateUploadUrl();
  },
});

export const listDocuments = query({
  args: { laboratoryId: v.id("laboratories"), status: v.optional(v.string()), type: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let docs = await ctx.db.query("documents").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect();
    if (args.status) docs = docs.filter((d) => d.status === args.status);
    if (args.type) docs = docs.filter((d) => d.type === args.type);
    return await Promise.all(docs.map(async (d) => {
      const owner = d.owner ? await ctx.db.get(d.owner) : null;
      const dept = d.departmentId ? await ctx.db.get(d.departmentId) : null;
      const fileUrl = d.fileStorageId ? await ctx.storage.getUrl(d.fileStorageId) : (d.fileUrl ?? null);
      return { ...d, ownerName: owner?.name, departmentName: dept?.name, resolvedFileUrl: fileUrl };
    }));
  },
});

export const getDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return null;
    const owner = doc.owner ? await ctx.db.get(doc.owner) : null;
    const approvedBy = doc.approvedBy ? await ctx.db.get(doc.approvedBy) : null;
    const reviewedBy = doc.reviewedBy ? await ctx.db.get(doc.reviewedBy) : null;
    const dept = doc.departmentId ? await ctx.db.get(doc.departmentId) : null;
    const fileUrl = doc.fileStorageId ? await ctx.storage.getUrl(doc.fileStorageId) : (doc.fileUrl ?? null);
    return { ...doc, ownerName: owner?.name, approvedByName: approvedBy?.name, reviewedByName: reviewedBy?.name, departmentName: dept?.name, resolvedFileUrl: fileUrl };
  },
});

export const createDocument = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    title: v.string(),
    type: v.union(v.literal("sop"), v.literal("method"), v.literal("policy"), v.literal("form"), v.literal("specification"), v.literal("validation"), v.literal("safety"), v.literal("other")),
    version: v.string(),
    departmentId: v.optional(v.id("departments")),
    owner: v.optional(v.id("users")),
    effectiveDate: v.optional(v.string()),
    reviewDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    content: v.optional(v.string()),
    description: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const docNumber = await nextDocNumber(ctx, args.laboratoryId);
    return await ctx.db.insert("documents", { ...args, documentNumber: docNumber, status: "draft", isActive: true, createdBy: user._id });
  },
});

export const updateDocument = mutation({
  args: {
    documentId: v.id("documents"),
    title: v.optional(v.string()),
    type: v.optional(v.union(v.literal("sop"), v.literal("method"), v.literal("policy"), v.literal("form"), v.literal("specification"), v.literal("validation"), v.literal("safety"), v.literal("other"))),
    version: v.optional(v.string()),
    status: v.optional(v.union(v.literal("draft"), v.literal("under_review"), v.literal("approved"), v.literal("effective"), v.literal("superseded"), v.literal("obsolete"))),
    departmentId: v.optional(v.id("departments")),
    owner: v.optional(v.id("users")),
    reviewedBy: v.optional(v.id("users")),
    approvedBy: v.optional(v.id("users")),
    effectiveDate: v.optional(v.string()),
    reviewDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    content: v.optional(v.string()),
    description: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    const { documentId, ...fields } = args;
    const doc = await ctx.db.get(documentId);
    if (!doc) throw new ConvexError({ message: "Document not found", code: "NOT_FOUND" });
    // If a new storageId is provided, delete old stored file
    if (fields.fileStorageId && doc.fileStorageId && fields.fileStorageId !== doc.fileStorageId) {
      await ctx.storage.delete(doc.fileStorageId);
    }
    await ctx.db.patch(documentId, fields);
  },
});

export const deleteDocument = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (doc?.fileStorageId) await ctx.storage.delete(doc.fileStorageId);
    await ctx.db.patch(args.documentId, { isActive: false, status: "obsolete" });
  },
});

