import React from "react";
import LoadingState from "../../../components/LoadingState";

type Props = React.ComponentProps<typeof LoadingState>;

export default function Loader(props: Props) {
  return <LoadingState {...props} />;
}
