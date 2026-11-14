import type { DetailedHTMLProps, HTMLAttributes } from "react";

type ConvaiWidgetProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  "agent-id"?: string;
  "action-text"?: string;
  "dynamic-variables"?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": ConvaiWidgetProps;
    }
  }
}
