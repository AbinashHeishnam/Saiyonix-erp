import React from "react";
import BaseEmptyState from "../../../components/EmptyState";

type Props = React.ComponentProps<typeof BaseEmptyState>;

export default function EmptyState(props: Props) {
  return <BaseEmptyState {...props} />;
}
