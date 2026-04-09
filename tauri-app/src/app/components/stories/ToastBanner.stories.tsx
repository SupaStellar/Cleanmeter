import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ToastBanner,
  ToastBannerIcon,
  ToastBannerContent,
  ToastBannerTitle,
  ToastBannerDescription,
  ToastBannerActions,
} from "../ToastBanner";
import { Button } from "../Button";

const meta: Meta<typeof ToastBanner> = {
  title: "Components/ToastBanner",
  component: ToastBanner,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ToastBanner>;

function CloudDownloadIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.833 16.667a4.02 4.02 0 0 1-2.948-1.219A4.02 4.02 0 0 1 1.667 12.5c0-1.028.347-1.93 1.041-2.708.695-.778 1.57-1.236 2.625-1.375a5.197 5.197 0 0 1 1.896-3.063A5.143 5.143 0 0 1 10.417 4.17c1.444 0 2.687.5 3.729 1.5 1.041 1 1.618 2.222 1.729 3.667a4.078 4.078 0 0 1 2.458 1.396c.667.805 1 1.725 1 2.76 0 1.138-.395 2.106-1.187 2.906-.792.791-1.76 1.19-2.896 1.198v-.063H5.833Zm4.167-3l3-3h-2.083V7.5H9.083v3.167H7l3 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

export const Default: Story = {
  render: () => (
    <ToastBanner className="w-[499px]">
      <ToastBannerIcon>
        <CloudDownloadIcon />
      </ToastBannerIcon>
      <ToastBannerContent>
        <ToastBannerTitle>New update available</ToastBannerTitle>
        <ToastBannerDescription>v0.1.0</ToastBannerDescription>
      </ToastBannerContent>
      <ToastBannerActions>
        <Button variant="link">Later</Button>
        <Button variant="filled-white">Update now</Button>
      </ToastBannerActions>
    </ToastBanner>
  ),
};

export const TitleOnly: Story = {
  render: () => (
    <ToastBanner className="w-[499px]">
      <ToastBannerIcon>
        <CloudDownloadIcon />
      </ToastBannerIcon>
      <ToastBannerContent>
        <ToastBannerTitle>New update available</ToastBannerTitle>
      </ToastBannerContent>
      <ToastBannerActions>
        <Button variant="filled-white">Update now</Button>
      </ToastBannerActions>
    </ToastBanner>
  ),
};

export const NoActions: Story = {
  render: () => (
    <ToastBanner className="w-[499px]">
      <ToastBannerIcon>
        <CloudDownloadIcon />
      </ToastBannerIcon>
      <ToastBannerContent>
        <ToastBannerTitle>Download complete</ToastBannerTitle>
        <ToastBannerDescription>
          CleanMeter v0.1.0 installed successfully
        </ToastBannerDescription>
      </ToastBannerContent>
    </ToastBanner>
  ),
};
