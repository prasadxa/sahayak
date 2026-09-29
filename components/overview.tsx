"use client";

import { motion } from "framer-motion";
import { Doc } from "@/convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";

interface OverviewProps {
  user: Doc<"users"> | null;
}

export const Overview = ({ user }: OverviewProps) => {
  const { t } = useI18n();
  const firstName = user?.name ? user.name.split(" ")[0] : null;

  return (
    <div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20 px-4 size-full flex flex-col justify-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"
      >
        <span className="inline-block size-2 rounded-full bg-emerald-600" />
        {t("overviewBadge")}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
        className="text-2xl font-semibold mt-2"
      >
        {firstName ? t("greetingNamed", { name: firstName }) : t("greeting")}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
        className="text-2xl text-zinc-500"
      >
        {t("askMe")}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.7 }}
        className="mt-4"
      >
        <p className="font-medium text-sm text-muted-foreground">{t("askHint")}</p>
      </motion.div>
    </div>
  );
};
