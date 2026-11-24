# Author: permails <logo@permails.com>
include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-watchtower
PKG_VERSION:=0.26.11
PKG_RELEASE:=1

PKG_MAINTAINER:=permails <logo@permails.com>

LUCI_TITLE:=LuCI support for Watchtower
LUCI_PKGARCH:=all
LUCI_DEPENDS:=+iputils-arping +curl +jq +openssl-util
LUCI_PKGMAINTAINER:=permails <logo@permails.com>

define Package/$(PKG_NAME)/conffiles
/etc/config/watchtower
/usr/bin/watchtower/api/diy.json
/usr/bin/watchtower/api/ipv4.list
/usr/bin/watchtower/api/ipv6.list
/usr/bin/watchtower/api/ip_blacklist
/usr/bin/watchtower/api/known_macs
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
