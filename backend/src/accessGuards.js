export function hasInternalPageAccess(access, page) {
  if (access?.role !== "internal" && access?.role !== "superadmin") {
    return false;
  }

  if (access.isAdmin || access.role === "superadmin") {
    return true;
  }

  const pagesToCheck = Array.isArray(page) ? page : [page];
  const gdPages = [
    "geracao-digital",
    "implantacao-gd",
    "propostas-gd",
    "briefings-gd",
    "apresentacao-gd",
    "dashboard-gd",
    "contratos-gd",
    "pacotes-gd",
    "condicoes-gd",
  ];

  const isGdPage = pagesToCheck.some((p) => gdPages.includes(p));
  if (isGdPage) {
    const hasGdAccess = access.internalPages?.some((p) => gdPages.includes(p));
    if (hasGdAccess || !access.internalPages || access.internalPages.length === 0) {
      return true;
    }
  }

  if (pagesToCheck.some((p) => access.internalPages?.includes(p))) {
    return true;
  }

  return (
    page === "empresas" &&
    access.accessPreset === "gestor" &&
    access.internalPages?.includes("usuarios")
  );
}

export function hasClientViewAccess(access, view) {
  return access?.role === "client" && access.allowedViews?.includes(view);
}

export function hasAccessPermission(access, permission) {
  if (access?.role !== "internal") {
    return false;
  }

  if (access.isAdmin || access.permissions?.includes(permission)) {
    return true;
  }

  return (
    permission === "tenants.manage" &&
    access.accessPreset === "gestor" &&
    access.internalPages?.includes("usuarios") &&
    access.permissions?.includes("users.view")
  );
}

export function canAccessAppView(access, view) {
  return hasInternalPageAccess(access, view) || hasClientViewAccess(access, view);
}
