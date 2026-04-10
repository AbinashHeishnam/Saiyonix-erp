import React from "react";
import BaseTable from "../../../components/Table";

type Props = React.ComponentProps<typeof BaseTable>;

export default function Table(props: Props) {
  return <BaseTable {...props} />;
}
