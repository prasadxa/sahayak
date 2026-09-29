"use client";

import { UseChatHelpers } from "@ai-sdk/react";
import { Landmark, Scale, ShieldCheck, FileWarning, Wallet, Wheat } from "lucide-react";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";

interface SuggestedActionsProps {
  chatId: string;
  append: UseChatHelpers["append"];
}

const SUGGESTIONS = [
  { id: "laws", icon: Scale },
  { id: "schemes", icon: Landmark },
  { id: "pmfby", icon: Wheat },
  { id: "finance", icon: Wallet },
  { id: "grievance", icon: FileWarning },
  { id: "services", icon: ShieldCheck },
] as const;

// Not memoised: the titles and prompts must re-render when the language changes.
export const SuggestedActions = ({ chatId, append }: SuggestedActionsProps) => {
  const { t } = useI18n();
  const suggestedActions = SUGGESTIONS.map(({ id, icon: Icon }) => ({
    id,
    title: t(`suggest.${id}.title`),
    label: t(`suggest.${id}.label`),
    action: t(`suggest.${id}.prompt`),
    icon: <Icon className="w-4 h-4 mr-2" />,
  }));

  return (
    <div className="grid sm:grid-cols-2 gap-2 w-full">
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.id}`}
          className={index > 1 ? "hidden sm:block" : "block"}
        >
          <Button
            variant="ghost"
            onClick={async () => {
              window.history.replaceState({}, "", `/chat/${chatId}`);

              append({
                role: "user",
                content: suggestedAction.action,
              });
            }}
            className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
          >
            <div className="flex items-center">
              {suggestedAction.icon}
              <span className="font-medium">{suggestedAction.title}</span>
            </div>
            <span className="text-muted-foreground">{suggestedAction.label}</span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
};
