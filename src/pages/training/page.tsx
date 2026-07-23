import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { useRole, ALL_ROLES } from "@/hooks/use-role.ts";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  GraduationCap,
  Plus,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserPlus,
  Trash2,
} from "lucide-react";
import { format, parseISO, differenceInDays, isAfter } from "date-fns";
import { cn } from "@/lib/utils.ts";

// --- Type configs ---

const COURSE_TYPES = ["sop", "method", "safety", "instrument", "regulatory", "other"] as const;
type CourseType = (typeof COURSE_TYPES)[number];

const COURSE_TYPE_COLORS: Record<CourseType, string> = {
  sop: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  method: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  safety: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  instrument: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  regulatory: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  other: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const ASSIGNMENT_STATUS_COLORS: Record<string, string> = {
  assigned: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  expired: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

// --- Helper Components ---

function TypeBadge({ type }: { type: string }) {
  const colors = COURSE_TYPE_COLORS[type as CourseType] ?? COURSE_TYPE_COLORS.other;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", colors)}>
      {type.toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = ASSIGNMENT_STATUS_COLORS[status] ?? ASSIGNMENT_STATUS_COLORS.assigned;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize", colors)}>
      {status.replace("_", " ")}
    </span>
  );
}

// --- KPI helpers ---

type CourseItem = {
  _id: string;
  courseCode: string;
  title: string;
  type: string;
  durationHours?: number;
  validityMonths?: number;
  assessmentRequired: boolean;
  passingScore?: number;
  description?: string;
};

type AssignmentItem = {
  _id: string;
  userId: string;
  userName?: string;
  courseId: string;
  courseTitle?: string;
  courseCode?: string;
  status: string;
  assignedDate: string;
  dueDate?: string;
  completedDate?: string;
  score?: number;
  expiryDate?: string;
  assessmentRequired?: boolean;
};

type MatrixCell = {
  userId: string;
  userName: string;
  courses: Record<string, { status: "completed" | "expiring" | "overdue" | "not_assigned" }>;
};

function computeKpis(courses: CourseItem[] | undefined, assignments: AssignmentItem[] | undefined) {
  const totalCourses = courses?.length ?? 0;

  if (!assignments) {
    return { totalCourses, completedThisMonth: 0, overdue: 0, expiringSoon: 0 };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const completedThisMonth = assignments.filter((a) => {
    if (a.status !== "completed" || !a.completedDate) return false;
    return isAfter(parseISO(a.completedDate), monthStart);
  }).length;

  const overdue = assignments.filter((a) => a.status === "overdue").length;

  const expiringSoon = assignments.filter((a) => {
    if (!a.expiryDate || a.status !== "completed") return false;
    const daysUntilExpiry = differenceInDays(parseISO(a.expiryDate), now);
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  }).length;

  return { totalCourses, completedThisMonth, overdue, expiringSoon };
}

// --- New Course Dialog ---

function NewCourseDialog({
  labId,
  open,
  onClose,
}: {
  labId: string;
  open: boolean;
  onClose: () => void;
}) {
  const createCourse = useMutation(api.training.createCourse);
  const [form, setForm] = useState({
    title: "",
    type: "",
    description: "",
    durationHours: "",
    validityMonths: "",
    assessmentRequired: false,
    passingScore: "",
    linkedDocument: "",
    linkedMethod: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.type) {
      toast.error("Type is required");
      return;
    }
    setSaving(true);
    try {
      await createCourse({
        laboratoryId: labId as never,
        title: form.title,
        type: form.type as "sop" | "method" | "safety" | "instrument" | "regulatory" | "other",
        description: form.description || undefined,
        durationHours: form.durationHours ? Number(form.durationHours) : undefined,
        validityMonths: form.validityMonths ? Number(form.validityMonths) : undefined,
        assessmentRequired: form.assessmentRequired,
        passingScore: form.assessmentRequired && form.passingScore ? Number(form.passingScore) : undefined,
        linkedDocumentId: undefined,
        linkedMethodId: undefined,
      });
      toast.success("Course created");
      setForm({
        title: "",
        type: "",
        description: "",
        durationHours: "",
        validityMonths: "",
        assessmentRequired: false,
        passingScore: "",
        linkedDocument: "",
        linkedMethod: "",
      });
      onClose();
    } catch (e) {
      if (e instanceof ConvexError) toast.error((e.data as { message: string }).message);
      else toast.error("Failed to create course");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Training Course</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. HPLC Method Competency"
            />
          </div>
          <div className="space-y-1">
            <Label>Type *</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {COURSE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Duration (hours)</Label>
            <Input
              type="number"
              value={form.durationHours}
              onChange={(e) => set("durationHours", e.target.value)}
              placeholder="e.g. 4"
            />
          </div>
          <div className="space-y-1">
            <Label>Validity (months)</Label>
            <Input
              type="number"
              value={form.validityMonths}
              onChange={(e) => set("validityMonths", e.target.value)}
              placeholder="e.g. 12"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              placeholder="Brief description of the training course"
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <Checkbox
              checked={form.assessmentRequired}
              onCheckedChange={(v) => set("assessmentRequired", Boolean(v))}
            />
            <Label className="cursor-pointer" onClick={() => set("assessmentRequired", !form.assessmentRequired)}>
              Assessment Required
            </Label>
          </div>
          {form.assessmentRequired && (
            <div className="col-span-2 space-y-1">
              <Label>Passing Score (%)</Label>
              <Input
                type="number"
                value={form.passingScore}
                onChange={(e) => set("passingScore", e.target.value)}
                placeholder="e.g. 80"
              />
            </div>
          )}
          <div className="col-span-2 space-y-1">
            <Label>Link to Document</Label>
            <Input
              value={form.linkedDocument}
              onChange={(e) => set("linkedDocument", e.target.value)}
              placeholder="e.g. SOP-CHM-001 rev3"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Link to Method</Label>
            <Input
              value={form.linkedMethod}
              onChange={(e) => set("linkedMethod", e.target.value)}
              placeholder="e.g. MET-HPLC-012"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Creating…" : "Create Course"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Assign Training Dialog ---

function AssignTrainingDialog({
  labId,
  courses,
  open,
  onClose,
}: {
  labId: string;
  courses: CourseItem[];
  open: boolean;
  onClose: () => void;
}) {
  const assignTraining = useMutation(api.training.assignTraining);
  const users = useQuery(api.users.listUsers, {});
  const [form, setForm] = useState({
    userId: "",
    courseId: "",
    dueDate: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.userId || !form.courseId) {
      toast.error("User and Course are required");
      return;
    }
    setSaving(true);
    try {
      await assignTraining({
        laboratoryId: labId as never,
        userId: form.userId as never,
        courseId: form.courseId as never,
        dueDate: form.dueDate || undefined,
      });
      toast.success("Training assigned");
      setForm({ userId: "", courseId: "", dueDate: "" });
      onClose();
    } catch (e) {
      if (e instanceof ConvexError) toast.error((e.data as { message: string }).message);
      else toast.error("Failed to assign training");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Training</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>User *</Label>
            <Select value={form.userId} onValueChange={(v) => set("userId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select analyst" />
              </SelectTrigger>
              <SelectContent>
                {(users ?? []).map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name ?? u.email ?? u._id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Course *</Label>
            <Select value={form.courseId} onValueChange={(v) => set("courseId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.courseCode} — {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Due Date</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Assigning…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Complete Training Dialog ---

function CompleteTrainingDialog({
  assignment,
  open,
  onClose,
}: {
  assignment: AssignmentItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const completeTraining = useMutation(api.training.completeTraining);
  const [completedDate, setCompletedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [score, setScore] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!assignment) return;
    if (!completedDate) {
      toast.error("Completion date is required");
      return;
    }
    setSaving(true);
    try {
      await completeTraining({
        assignmentId: assignment._id as never,
        completedDate,
        assessmentScore: score ? Number(score) : undefined,
      });
      toast.success("Training marked as complete");
      setScore("");
      onClose();
    } catch (e) {
      if (e instanceof ConvexError) toast.error((e.data as { message: string }).message);
      else toast.error("Failed to complete training");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Complete Training</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {assignment?.courseTitle ?? "Training"}
          </p>
          <div className="space-y-1">
            <Label>Completion Date *</Label>
            <Input
              type="date"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
            />
          </div>
          {assignment?.assessmentRequired && (
            <div className="space-y-1">
              <Label>Score (%)</Label>
              <Input
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="e.g. 85"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Mark Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Courses Tab ---

function CoursesTab({
  courses,
  onAssign,
}: {
  courses: CourseItem[] | undefined;
  onAssign: (courseId: string) => void;
}) {
  if (courses === undefined) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">No courses yet</p>
        <p className="text-sm">Create your first training course to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {courses.map((course) => (
        <Card key={course._id} className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-mono">{course.courseCode}</p>
                <CardTitle className="text-sm font-semibold mt-0.5 truncate">
                  {course.title}
                </CardTitle>
              </div>
              <TypeBadge type={course.type} />
            </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-2 pt-0">
            {course.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {course.durationHours != null && (
                <span className="flex items-center gap-1">
                  <Clock size={11} /> {course.durationHours}h
                </span>
              )}
              {course.validityMonths != null && (
                <span>Valid {course.validityMonths} months</span>
              )}
            </div>
            {course.assessmentRequired && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                Assessment {course.passingScore ? `≥${course.passingScore}%` : "Required"}
              </span>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="secondary"
                className="cursor-pointer"
                onClick={() => onAssign(course._id)}
              >
                <UserPlus size={13} className="mr-1" /> Assign
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --- Assignments Tab ---

function AssignmentsTab({
  assignments,
  onComplete,
  onDelete,
}: {
  assignments: AssignmentItem[] | undefined;
  onComplete: (assignment: AssignmentItem) => void;
  onDelete: (id: string) => void;
}) {
  if (assignments === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <UserPlus size={40} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">No assignments</p>
        <p className="text-sm">Assign training courses to analysts to track competency.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Course</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Completed</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Expiry</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((a) => (
            <TableRow key={a._id}>
              <TableCell className="font-medium">{a.userName ?? "—"}</TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">{a.courseCode}</span>{" "}
                {a.courseTitle}
              </TableCell>
              <TableCell>
                <StatusBadge status={a.status} />
              </TableCell>
              <TableCell className="text-sm">
                {a.assignedDate ? format(parseISO(a.assignedDate), "dd MMM yyyy") : "—"}
              </TableCell>
              <TableCell className="text-sm">
                {a.dueDate ? format(parseISO(a.dueDate), "dd MMM yyyy") : "—"}
              </TableCell>
              <TableCell className="text-sm">
                {a.completedDate ? format(parseISO(a.completedDate), "dd MMM yyyy") : "—"}
              </TableCell>
              <TableCell className="text-sm">
                {a.score != null ? `${a.score}%` : "—"}
              </TableCell>
              <TableCell className="text-sm">
                {a.expiryDate ? format(parseISO(a.expiryDate), "dd MMM yyyy") : "—"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {a.status !== "completed" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => onComplete(a)}
                    >
                      <CheckCircle2 size={13} className="mr-1" /> Complete
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer text-destructive hover:text-destructive"
                    onClick={() => onDelete(a._id)}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// --- My Training Tab ---

function MyTrainingTab({ assignments }: { assignments: AssignmentItem[] | undefined }) {
  if (assignments === undefined) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">No training assigned to you</p>
        <p className="text-sm">You have no pending or completed training records.</p>
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {assignments.map((a) => {
        const isOverdue = a.status === "overdue";
        const isExpiringSoon =
          a.status === "completed" &&
          a.expiryDate &&
          differenceInDays(parseISO(a.expiryDate), now) <= 30 &&
          differenceInDays(parseISO(a.expiryDate), now) >= 0;

        return (
          <Card
            key={a._id}
            className={cn(
              "transition-shadow",
              isOverdue && "border-red-400 dark:border-red-600",
              isExpiringSoon && "border-amber-400 dark:border-amber-600"
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-mono">{a.courseCode}</p>
                  <CardTitle className="text-sm font-semibold mt-0.5 truncate">
                    {a.courseTitle}
                  </CardTitle>
                </div>
                <StatusBadge status={a.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-1 pt-0 text-xs text-muted-foreground">
              {a.dueDate && (
                <p>
                  Due: <span className="font-medium text-foreground">{format(parseISO(a.dueDate), "dd MMM yyyy")}</span>
                </p>
              )}
              {a.completedDate && (
                <p>
                  Completed: <span className="font-medium text-foreground">{format(parseISO(a.completedDate), "dd MMM yyyy")}</span>
                </p>
              )}
              {a.score != null && <p>Score: <span className="font-medium text-foreground">{a.score}%</span></p>}
              {a.expiryDate && (
                <p className={cn(isExpiringSoon && "text-amber-600 dark:text-amber-400 font-medium")}>
                  Expires: {format(parseISO(a.expiryDate), "dd MMM yyyy")}
                  {isExpiringSoon && " (expiring soon)"}
                </p>
              )}
              {isOverdue && (
                <p className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                  <AlertTriangle size={12} /> Overdue
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// --- Competency Matrix Tab ---

function CompetencyMatrixTab({
  matrix,
  courses,
}: {
  matrix: MatrixCell[] | undefined;
  courses: CourseItem[] | undefined;
}) {
  if (matrix === undefined || courses === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (matrix.length === 0 || courses.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">No data for competency matrix</p>
        <p className="text-sm">Create courses and assign training to populate the matrix.</p>
      </div>
    );
  }

  const cellStyles: Record<string, { symbol: string; color: string }> = {
    completed: { symbol: "✓", color: "text-green-600 dark:text-green-400 font-bold" },
    expiring: { symbol: "⚠", color: "text-amber-600 dark:text-amber-400 font-bold" },
    overdue: { symbol: "✗", color: "text-red-600 dark:text-red-400 font-bold" },
    not_assigned: { symbol: "—", color: "text-gray-400 dark:text-gray-600" },
  };

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">
              Analyst
            </TableHead>
            {courses.map((c) => (
              <TableHead key={c._id} className="text-center min-w-[80px]">
                <span className="text-xs">{c.courseCode}</span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {matrix.map((row) => (
            <TableRow key={row.userId}>
              <TableCell className="sticky left-0 bg-background z-10 font-medium">
                {row.userName}
              </TableCell>
              {courses.map((c) => {
                const cellStatus = row.courses[c._id]?.status ?? "not_assigned";
                const style = cellStyles[cellStatus] ?? cellStyles.not_assigned;
                return (
                  <TableCell key={c._id} className={cn("text-center text-base", style.color)}>
                    {style.symbol}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// --- Main Page Inner ---

function TrainingInner() {
  const { labId } = useActiveLab();
  const { user } = useRole();

  const [newCourseOpen, setNewCourseOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentItem | null>(null);
  const [activeTab, setActiveTab] = useState("courses");

  const courses = useQuery(api.training.listCourses, labId ? { laboratoryId: labId } : "skip");
  const allAssignments = useQuery(
    api.training.listAssignments,
    labId ? { laboratoryId: labId } : "skip"
  );
  const myAssignments = useQuery(
    api.training.getMyAssignments,
    labId ? { laboratoryId: labId } : "skip"
  );
  const competencyMatrix = useQuery(
    api.training.getCompetencyMatrix,
    labId ? { laboratoryId: labId } : "skip"
  );

  const deleteAssignment = useMutation(api.training.deleteAssignment);

  if (!labId) {
    return <div className="p-8 text-muted-foreground">No laboratory configured.</div>;
  }

  const kpis = computeKpis(courses as CourseItem[] | undefined, allAssignments as AssignmentItem[] | undefined);

  const handleComplete = (assignment: AssignmentItem) => {
    setSelectedAssignment(assignment);
    setCompleteDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAssignment({ assignmentId: id as never });
      toast.success("Assignment deleted");
    } catch (e) {
      if (e instanceof ConvexError) toast.error((e.data as { message: string }).message);
      else toast.error("Failed to delete assignment");
    }
  };

  const handleAssignFromCourse = (_courseId: string) => {
    setAssignOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap size={22} className="text-primary" /> Training & Competency
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Courses, Assignments & Analyst Qualifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="cursor-pointer" onClick={() => setNewCourseOpen(true)}>
            <Plus size={16} className="mr-1" /> New Course
          </Button>
          <Button
            variant="secondary"
            className="cursor-pointer"
            onClick={() => setAssignOpen(true)}
          >
            <UserPlus size={16} className="mr-1" /> Assign Training
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Courses",
            value: kpis.totalCourses,
            icon: <BookOpen size={18} />,
            color: "text-primary",
          },
          {
            label: "Completed (Month)",
            value: kpis.completedThisMonth,
            icon: <CheckCircle2 size={18} />,
            color: "text-green-600",
          },
          {
            label: "Overdue",
            value: kpis.overdue,
            icon: <AlertTriangle size={18} />,
            color: "text-destructive",
          },
          {
            label: "Expiring Soon",
            value: kpis.expiringSoon,
            icon: <Clock size={18} />,
            color: "text-amber-500",
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-0.5">
                  {courses === undefined ? <Skeleton className="h-7 w-10" /> : s.value}
                </p>
              </div>
              <span className={s.color}>{s.icon}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="courses" className="cursor-pointer">Courses</TabsTrigger>
          <TabsTrigger value="assignments" className="cursor-pointer">All Assignments</TabsTrigger>
          <TabsTrigger value="my-training" className="cursor-pointer">My Training</TabsTrigger>
          <TabsTrigger value="matrix" className="cursor-pointer">Competency Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-4">
          <CoursesTab
            courses={courses as CourseItem[] | undefined}
            onAssign={handleAssignFromCourse}
          />
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <AssignmentsTab
            assignments={allAssignments as AssignmentItem[] | undefined}
            onComplete={handleComplete}
            onDelete={handleDelete}
          />
        </TabsContent>

        <TabsContent value="my-training" className="mt-4">
          <MyTrainingTab assignments={myAssignments as AssignmentItem[] | undefined} />
        </TabsContent>

        <TabsContent value="matrix" className="mt-4">
          <CompetencyMatrixTab
            matrix={competencyMatrix as MatrixCell[] | undefined}
            courses={courses as CourseItem[] | undefined}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <NewCourseDialog labId={labId} open={newCourseOpen} onClose={() => setNewCourseOpen(false)} />
      <AssignTrainingDialog
        labId={labId}
        courses={(courses as CourseItem[]) ?? []}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
      />
      <CompleteTrainingDialog
        assignment={selectedAssignment}
        open={completeDialogOpen}
        onClose={() => {
          setCompleteDialogOpen(false);
          setSelectedAssignment(null);
        }}
      />
    </div>
  );
}

// --- Default Export ---

export default function TrainingPage() {
  return (
    <PageGuard allowed={ALL_ROLES}>
      <TrainingInner />
    </PageGuard>
  );
}
