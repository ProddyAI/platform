import { LiveList } from "@liveblocks/client";
import { useMutation, useSelf } from "../../../../liveblocks.config";

export const useDeleteLayers = () => {
	const selection = useSelf((me) => me.presence.selection);

	return useMutation(
		({ storage, setMyPresence }) => {
			const liveLayers = storage.get("layers");
			const liveLayerIds = storage.get("layerIds");

			if (!liveLayers || typeof liveLayers.delete !== "function") {
				console.error(
					"Error: liveLayers is not a LiveMap or doesn't have a delete method",
					liveLayers
				);
				return;
			}

			for (const id of selection) {
				liveLayers.delete(id);

				if (liveLayerIds) {
					if (typeof liveLayerIds.delete === "function") {
						const index = liveLayerIds.indexOf(id);
						if (index !== -1) {
							liveLayerIds.delete(index);
						}
					} else if (Array.isArray(liveLayerIds)) {
						try {
							const newLayerIds = new LiveList(
								(liveLayerIds as string[]).filter((layerId) => layerId !== id)
							);
							storage.set("layerIds", newLayerIds);
						} catch (error) {
							console.error(
								"Failed to create new LiveList for layerIds:",
								error
							);
						}
					} else {
						console.warn(
							"liveLayerIds is not a LiveList or array, cannot remove id"
						);
					}
				}
			}

			// Clear the selection
			setMyPresence({ selection: [] }, { addToHistory: true });
		},
		[selection]
	);
};
