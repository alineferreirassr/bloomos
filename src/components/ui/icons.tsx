import type { SVGProps } from "react";
import { LayoutGrid, UserPlus, Users, Calendar, FileText, Wallet, Menu, X } from "lucide-react";

type IconProps = SVGProps<SVGSVGElement>;

export function DashboardIcon(props: IconProps) {
  return <LayoutGrid strokeWidth={1.5} aria-hidden="true" {...props} />;
}

export function LeadsIcon(props: IconProps) {
  return <UserPlus strokeWidth={1.5} aria-hidden="true" {...props} />;
}

export function ClientsIcon(props: IconProps) {
  return <Users strokeWidth={1.5} aria-hidden="true" {...props} />;
}

export function EventsIcon(props: IconProps) {
  return <Calendar strokeWidth={1.5} aria-hidden="true" {...props} />;
}

export function ContractsIcon(props: IconProps) {
  return <FileText strokeWidth={1.5} aria-hidden="true" {...props} />;
}

export function FinanceIcon(props: IconProps) {
  return <Wallet strokeWidth={1.5} aria-hidden="true" {...props} />;
}

export function MenuIcon(props: IconProps) {
  return <Menu strokeWidth={1.5} aria-hidden="true" {...props} />;
}

export function CloseIcon(props: IconProps) {
  return <X strokeWidth={1.5} aria-hidden="true" {...props} />;
}
