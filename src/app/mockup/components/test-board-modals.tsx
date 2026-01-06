"use client";

import { format } from "date-fns";
import { AlertTriangle, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface TestBoardModalsProps {
	selectedCard: any;
	isCardModalOpen: boolean;
	onCardModalClose: () => void;
	onSaveCard: (card: any) => void;
	isAddCardModalOpen: boolean;
	onAddCardModalClose: () => void;
	onCreateCard: (card: any) => void;
	members: any[];
	selectedListId: string | null;
	lists: any[];
}

const PREDEFINED_LABELS = [
	"frontend",
	"backend",
	"api",
	"database",
	"ui/ux",
	"design",
	"mobile",
	"testing",
	"security",
	"performance",
	"documentation",
	"bug",
	"feature",
	"critical",
	"urgent",
	"enhancement",
	"refactor",
	"deployment",
	"devops",
];

export const TestBoardModals = ({
	selectedCard,
	isCardModalOpen,
	onCardModalClose,
	onSaveCard,
	isAddCardModalOpen,
	onAddCardModalClose,
	onCreateCard,
	members,
	selectedListId,
	lists,
}: TestBoardModalsProps) => {
	const router = useRouter();
	const [editingCard, setEditingCard] = useState<any>(null);
	const [newCard, setNewCard] = useState({
		title: "",
		description: "",
		priority: "medium",
		dueDate: "",
		assignees: [] as string[],
		labels: [] as string[],
	});

	const handleViewNotes = () => {
		router.push("/mockup/notes");
	};

	useEffect(() => {
		if (selectedCard) {
			setEditingCard({
				...selectedCard,
				dueDate: selectedCard.dueDate
					? format(selectedCard.dueDate, "yyyy-MM-dd")
					: "",
			});
		}
	}, [selectedCard]);

	const handleSaveCard = () => {
		if (editingCard) {
			const updatedCard = {
				...editingCard,
				dueDate: editingCard.dueDate ? new Date(editingCard.dueDate) : null,
			};
			onSaveCard(updatedCard);
		}
	};

	const handleCreateCard = () => {
		if (newCard.title.trim()) {
			const cardToCreate = {
				...newCard,
				dueDate: newCard.dueDate ? new Date(newCard.dueDate) : null,
			};
			onCreateCard(cardToCreate);
			setNewCard({
				title: "",
				description: "",
				priority: "medium",
				dueDate: "",
				assignees: [],
				labels: [],
			});
		}
	};

	const toggleAssignee = (memberId: string, isEditing = false) => {
		if (isEditing && editingCard) {
			const assignees = editingCard.assignees || [];
			const newAssignees = assignees.includes(memberId)
				? assignees.filter((id: string) => id !== memberId)
				: [...assignees, memberId];
			setEditingCard({ ...editingCard, assignees: newAssignees });
		} else {
			const assignees = newCard.assignees || [];
			const newAssignees = assignees.includes(memberId)
				? assignees.filter((id) => id !== memberId)
				: [...assignees, memberId];
			setNewCard({ ...newCard, assignees: newAssignees });
		}
	};

	const toggleLabel = (label: string, isEditing = false) => {
		if (isEditing && editingCard) {
			const labels = editingCard.labels || [];
			const newLabels = labels.includes(label)
				? labels.filter((l: string) => l !== label)
				: [...labels, label];
			setEditingCard({ ...editingCard, labels: newLabels });
		} else {
			const labels = newCard.labels || [];
			const newLabels = labels.includes(label)
				? labels.filter((l) => l !== label)
				: [...labels, label];
			setNewCard({ ...newCard, labels: newLabels });
		}
	};

	const _getPriorityColor = (priority: string) => {
		switch (priority) {
			case "highest":
				return "text-red-600";
			case "high":
				return "text-orange-500";
			case "medium":
				return "text-yellow-600";
			case "low":
				return "text-green-600";
			default:
				return "text-gray-600";
		}
	};

	return (
		<>
			{/* Edit Card Modal */}
			<Dialog open={isCardModalOpen} onOpenChange={onCardModalClose}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Edit Card
						</DialogTitle>
					</DialogHeader>

					{editingCard && (
						<div className="space-y-6">
							{/* Title */}
							<div className="space-y-2">
								<Label htmlFor="title">Title</Label>
								<Input
									id="title"
									value={editingCard.title}
									onChange={(e) =>
										setEditingCard({ ...editingCard, title: e.target.value })
									}
									placeholder="Card title"
								/>
							</div>

							{/* Description */}
							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Textarea
									id="description"
									value={editingCard.description || ""}
									onChange={(e) =>
										setEditingCard({
											...editingCard,
											description: e.target.value,
										})
									}
									placeholder="Add a description..."
									rows={4}
								/>
							</div>

							{/* Priority and Due Date */}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="priority">Priority</Label>
									<Select
										value={editingCard.priority}
										onValueChange={(value) =>
											setEditingCard({ ...editingCard, priority: value })
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="highest">
												<div className="flex items-center gap-2">
													<AlertTriangle className="h-4 w-4 text-red-600" />
													<span className="text-red-600">Highest</span>
												</div>
											</SelectItem>
											<SelectItem value="high">
												<span className="text-orange-500">High</span>
											</SelectItem>
											<SelectItem value="medium">
												<span className="text-yellow-600">Medium</span>
											</SelectItem>
											<SelectItem value="low">
												<span className="text-green-600">Low</span>
											</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<Label htmlFor="dueDate">Due Date</Label>
									<Input
										id="dueDate"
										type="date"
										value={editingCard.dueDate}
										onChange={(e) =>
											setEditingCard({
												...editingCard,
												dueDate: e.target.value,
											})
										}
									/>
								</div>
							</div>

							{/* Assignees */}
							<div className="space-y-2">
								<Label>Assignees</Label>
								<div className="flex flex-wrap gap-2">
									{members.map((member) => (
										<Button
											key={member._id}
											variant={
												editingCard.assignees?.includes(member._id)
													? "default"
													: "outline"
											}
											size="sm"
											onClick={() => toggleAssignee(member._id, true)}
											className="flex items-center gap-2"
										>
											<Avatar className="h-4 w-4">
												<AvatarFallback className="text-xs">
													{member.user.name
														.split(" ")
														.map((n: string) => n[0])
														.join("")}
												</AvatarFallback>
											</Avatar>
											{member.user.name}
										</Button>
									))}
								</div>
							</div>

							{/* Labels */}
							<div className="space-y-2">
								<Label>Labels</Label>
								<div className="flex flex-wrap gap-2">
									{PREDEFINED_LABELS.map((label) => (
										<Button
											key={label}
											variant={
												editingCard.labels?.includes(label)
													? "default"
													: "outline"
											}
											size="sm"
											onClick={() => toggleLabel(label, true)}
										>
											{label}
										</Button>
									))}
								</div>
							</div>

							{/* Actions */}
							<div className="flex justify-between gap-2">
								<Button
									onClick={handleViewNotes}
									className="flex items-center gap-2"
									size="default"
								>
									<FileText className="h-4 w-4" />
									View Notes
								</Button>
								<div className="flex gap-2">
									<Button variant="outline" onClick={onCardModalClose}>
										Cancel
									</Button>
									<Button onClick={handleSaveCard}>Save Changes</Button>
								</div>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* Add Card Modal */}
			<Dialog open={isAddCardModalOpen} onOpenChange={onAddCardModalClose}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Add New Card
							{selectedListId && (
								<Badge variant="outline">
									{lists.find((l) => l._id === selectedListId)?.title}
								</Badge>
							)}
						</DialogTitle>
					</DialogHeader>

					<div className="space-y-6">
						{/* Title */}
						<div className="space-y-2">
							<Label htmlFor="newTitle">Title</Label>
							<Input
								id="newTitle"
								value={newCard.title}
								onChange={(e) =>
									setNewCard({ ...newCard, title: e.target.value })
								}
								placeholder="Card title"
							/>
						</div>

						{/* Description */}
						<div className="space-y-2">
							<Label htmlFor="newDescription">Description</Label>
							<Textarea
								id="newDescription"
								value={newCard.description}
								onChange={(e) =>
									setNewCard({ ...newCard, description: e.target.value })
								}
								placeholder="Add a description..."
								rows={4}
							/>
						</div>

						{/* Priority and Due Date */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="newPriority">Priority</Label>
								<Select
									value={newCard.priority}
									onValueChange={(value) =>
										setNewCard({ ...newCard, priority: value })
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="highest">
											<div className="flex items-center gap-2">
												<AlertTriangle className="h-4 w-4 text-red-600" />
												<span className="text-red-600">Highest</span>
											</div>
										</SelectItem>
										<SelectItem value="high">
											<span className="text-orange-500">High</span>
										</SelectItem>
										<SelectItem value="medium">
											<span className="text-yellow-600">Medium</span>
										</SelectItem>
										<SelectItem value="low">
											<span className="text-green-600">Low</span>
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="newDueDate">Due Date</Label>
								<Input
									id="newDueDate"
									type="date"
									value={newCard.dueDate}
									onChange={(e) =>
										setNewCard({ ...newCard, dueDate: e.target.value })
									}
								/>
							</div>
						</div>

						{/* Assignees */}
						<div className="space-y-2">
							<Label>Assignees</Label>
							<div className="flex flex-wrap gap-2">
								{members.map((member) => (
									<Button
										key={member._id}
										variant={
											newCard.assignees.includes(member._id)
												? "default"
												: "outline"
										}
										size="sm"
										onClick={() => toggleAssignee(member._id)}
										className="flex items-center gap-2"
									>
										<Avatar className="h-4 w-4">
											<AvatarFallback className="text-xs">
												{member.user.name
													.split(" ")
													.map((n: string) => n[0])
													.join("")}
											</AvatarFallback>
										</Avatar>
										{member.user.name}
									</Button>
								))}
							</div>
						</div>

						{/* Labels */}
						<div className="space-y-2">
							<Label>Labels</Label>
							<div className="flex flex-wrap gap-2">
								{PREDEFINED_LABELS.map((label) => (
									<Button
										key={label}
										variant={
											newCard.labels.includes(label) ? "default" : "outline"
										}
										size="sm"
										onClick={() => toggleLabel(label)}
									>
										{label}
									</Button>
								))}
							</div>
						</div>

						{/* Actions */}
						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={onAddCardModalClose}>
								Cancel
							</Button>
							<Button
								onClick={handleCreateCard}
								disabled={!newCard.title.trim()}
							>
								Create Card
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
};
