import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalStr } from "../GlobalStrContext";
import * as pubfunction from "./pubfunction";
import { clearJwtToken } from "./utils/jwtAuth";

// Interface representing the BaseMenuVo object
interface BaseMenuVo {
  menuName: string;
  menuValue: string;
}

const { width, height } = Dimensions.get("window");
const isSmallDevice = width < 360;
const scale = (size: number) => (width / 375) * size;

/**
 * Maps the 16 standard dynamic menu names to their corresponding 
 * titles, icons, and screens perfectly matching the design of src/Menu.tsx
 */
const getMenuDetails = (menuName: string) => {
  const name = (menuName || "").trim();

  switch (name) {
    case "Receive from Line":
      return {
        title: "Receive from\nLine",
        icon: require("../assets/logomenu/Inwarehouse.png"),
        screen: "InWarehouse",
      };
    case "Receive from China":
      return {
        title: "Receive from\nChina",
        icon: require("../assets/logomenu/Inwarehouse.png"),
        screen: "InWareHouseChina",
        disabled: true,
      };
    case "Not In Ware":
      return {
        title: "Not In\nWare",
        icon: require("../assets/logomenu/Notinware.png"),
        screen: "InWarehouse",
        disabled: true,
      };
    case "Delivery Scan":
      return {
        title: "Delivery Scan",
        icon: require("../assets/logomenu/Delivery.png"),
        screen: "DeliverySAP",
        disabled: true,
      };
    case "Allocate Out":
      return {
        title: "Allocate Out",
        icon: require("../assets/logomenu/Allocateout.png"),
        screen: "DeliverySAP",
        disabled: true,
      };
    case "Allocate In":
      return {
        title: "Allocate Into\nWarehouse",
        icon: require("../assets/logomenu/AllocateIn.png"),
        screen: "AllocateInNO",
      };
    case "Delivery Return":
      return {
        title: "Delivery Return",
        icon: require("../assets/logomenu/DeliveryReturn.png"),
        screen: "DeliverySAP",
        disabled: true,
      };
    case "Distributor Return":
      return {
        title: "Distributor\nReturn",
        icon: require("../assets/logomenu/reject.png"),
        screen: "DistributorReturnNONewSap",
        disabled: true,
      };
    case "Pallet/Box Detail":
      return {
        title: "Pallet/Box\nDetail",
        icon: require("../assets/logomenu/searchpallet.png"),
        screen: "PalletSearch",
      };
    case "GDS Inventory":
      return {
        title: "GDS Inventory",
        icon: require("../assets/logomenu/inventory1.png"),
        screen: "GDSInventory",
      };
    case "DFC Inventory":
      return {
        title: "DFC Inventory",
        icon: require("../assets/logomenu/inventory1.png"),
        screen: "DFCInventory",
      };
    case "Delivery Scan New":
      return {
        title: "Delivery Scan\nNew",
        icon: require("../assets/logomenu/Delivery.png"),
        screen: "DeliverySAP",
      };
    case "Allocate In New":
      return {
        title: "Allocate In\nNew",
        icon: require("../assets/logomenu/AllocateIn.png"),
        screen: "AllocateInNONewSap",
      };
    case "Allocate Out New":
      return {
        title: "Allocate Out\nNew",
        icon: require("../assets/logomenu/Allocateout.png"),
        screen: "AllocateOutNONewSap",
      };
    case "Delivery Return New":
      return {
        title: "Delivery Return\nNew",
        icon: require("../assets/logomenu/DeliveryReturn.png"),
        // Legacy delivery return flow (multi screen, menu url of the server)
        screen: "DeliveryReturnNONewSap",
      };
    case "Delivery Return Bill":
      return {
        title: "Delivery Return\nBill",
        icon: require("../assets/logomenu/DeliveryReturn.png"),
        // New delivery return flow (SN based return with traceability)
        screen: "DeliveryReturnBillSelect",
      };
    case "Return to original wh":
      return {
        title: "Return to\nOriginal WH",
        icon: require("../assets/logomenu/reject.png"),
        screen: "AllocateRejectInOldWMS",
      };
    default:
      // Adaptive split title fallback
      const formattedTitle = name.includes(" ")
        ? name.replace(/ (?=[^ ]+$)/, "\n")
        : name;
      return {
        title: formattedTitle,
        icon: require("../assets/logomenu/Inwarehouse.png"),
        screen: "InWarehouse",
      };
  }
};

const formatUserName = (name: string) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0];
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return `${firstName.charAt(0).toUpperCase()}. ${lastName}`;
};

export default function Menu({ navigation }: any) {
  const {
    gs_BaseURL,
    gs_userCode,
    gs_wareCode,
    gs_userName,
    gs_wareName,
    gs_PasswordSalt,
    gs_factoryindex,
  } = useGlobalStr();

    const styles = createStyles(gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc");

  const [filteredMenu, setFilteredMenu] = useState<BaseMenuVo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Load menu items from Web Service according to C# rules
  const getMenuListJava = async () => {
    setLoading(true);
    try {
      const urlCur = `${gs_BaseURL}/menu/userPermission/lxsh-wms-wince-api/${gs_userCode}/1/${gs_PasswordSalt}${pubfunction.GetUserSign("?")}`;

      const res = await fetch(urlCur);
      const data = await res.json();

      if (data && data.list) {
        const rawList: BaseMenuVo[] = typeof data.list === "string" ? JSON.parse(data.list) : data.list;

        // Filter valid forms (matching "GroupSCAN.")
        const validMenus: BaseMenuVo[] = [];
        for (const info of rawList) {
          const menuvalue = info.menuValue || "";
          const posInt = menuvalue.indexOf("GroupSCAN.");
          if (posInt > -1) {
            const trimmedValue = menuvalue.substring(posInt).trim();
            validMenus.push({
              menuName: info.menuName,
              menuValue: trimmedValue,
            });
          }
        }

        // The new "Delivery Return Bill" flow has no menu url of the server
        // yet, it rides on the same permission as the legacy "Delivery Return
        // New": one authorized entry on the server, two tiles on the screen.
        // Once the server adds its own entry the guard skips the duplicate.
        const menuWithName = (list: BaseMenuVo[], wanted: string) =>
          list.some((item) => (item.menuName || "").trim() === wanted);
        const expandedMenus: BaseMenuVo[] = [];
        for (const menu of validMenus) {
          expandedMenus.push(menu);
          if (
            (menu.menuName || "").trim() === "Delivery Return New" &&
            !menuWithName(validMenus, "Delivery Return Bill")
          ) {
            expandedMenus.push({
              menuName: "Delivery Return Bill",
              menuValue: menu.menuValue,
            });
          }
        }

        setFilteredMenu(expandedMenus);
        setCurrentPage(1);
      } else if (data && !data.success) {
        pubfunction.ShowError(data.msg || "Failed to load menus list");
      }
    } catch (err) {
      pubfunction.ShowError("Connect error, Please change URL link!");
    } finally {
      setLoading(false);
    }
  };

  // Component Mount Frm_mainNew_Load equivalent
  useEffect(() => {
    getMenuListJava();
  }, []);

  const handleReturn = async () => {
    await clearJwtToken();
    navigation.goBack();
  };

  const handleMenuClick = (item: BaseMenuVo) => {
    const details = getMenuDetails(item.menuName);
    if (details.disabled) {
      return;
    }
    if (details.screen) {
      navigation.navigate(details.screen);
    } else {
      Alert.alert(
        "Restricted Access",
        "This module is currently undergoing maintenance."
      );
    }
  };

  const totalPages = Math.ceil(filteredMenu.length / 10) || 1;
  const startIndex = (currentPage - 1) * 10;
  const currentPageItems = filteredMenu.slice(startIndex, startIndex + 10);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleReturn} activeOpacity={0.7}>
            <Image
              source={require("../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Warehouse Management</Text>
        </View>
      </View>

      {/* SubHeader */}
      <View style={styles.subHeader}>
        <View style={styles.subHeaderItem}>
          <Image
            source={require("../assets/logo/user.png")}
            style={styles.subHeaderIcon}
            resizeMode="contain"
          />
          <Text style={styles.subHeaderText}>
            {gs_userName ? formatUserName(gs_userName) : (gs_userCode || "Unknown")}
          </Text>
        </View>
        <View style={styles.subHeaderItem}>
          <Image
            source={require("../assets/logo/warehouse.png")}
            style={styles.subHeaderIcon}
            resizeMode="contain"
          />
          <Text style={styles.subHeaderText}>{gs_wareName || gs_wareCode || "Unknown"}</Text>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc"} />
          <Text style={styles.loadingText}>Loading permissions...</Text>
        </View>
      )}

      {/* Scrollable menu items grid matching /src/Menu.tsx */}
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {currentPageItems.map((item, index) => {
            const details = getMenuDetails(item.menuName);
            const isDisabled = details.disabled === true;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.card, isDisabled && { opacity: 0.35 }]}
                activeOpacity={isDisabled ? 1 : 0.7}
                disabled={isDisabled}
                onPress={() => handleMenuClick(item)}
              >
                <View style={styles.iconBox}>
                  <Image source={details.icon} style={styles.menuIcon} resizeMode="contain" />
                </View>

                <Text style={styles.cardText}>
                  {details.title}
                </Text>

                {!isDisabled && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}

          {currentPageItems.length === 0 && !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No permitted menu items found to display.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer Navigation Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.footerButton, currentPage <= 1 && styles.disabledFooterButton]}
          disabled={currentPage <= 1 || loading}
          onPress={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          activeOpacity={0.7}
        >
          <Image
            source={require("../assets/logo/prior.png")}
            style={[styles.footerIcon, currentPage <= 1 && styles.disabledFooterIcon]}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.footerButton, currentPage >= totalPages && styles.disabledFooterButton]}
          disabled={currentPage >= totalPages || loading}
          onPress={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          activeOpacity={0.7}
        >
          <Image
            source={require("../assets/logo/next.png")}
            style={[styles.footerIcon, currentPage >= totalPages && styles.disabledFooterIcon]}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (factoryColor: string) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    backgroundColor: factoryColor,
    paddingHorizontal: width * 0.05,
    height: scale(56),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  returnLogo: {
    width: scale(24),
    height: scale(24),
    marginRight: 10,
    tintColor: "#FFFFFF",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: isSmallDevice ? scale(14) : scale(16),
    fontWeight: "900",
  },
  subHeader: {
    flexDirection: 'row',
    backgroundColor: factoryColor,
    paddingHorizontal: 20,
    paddingBottom: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
    marginTop: -12, // overlap slightly to avoid gap
    marginLeft: -14,
  },
  subHeaderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  subHeaderIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
    tintColor: '#FFFFFF',
  },
  subHeaderText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContainer: {
    paddingHorizontal: width * 0.03,
    paddingTop: height * 0.01,
    paddingBottom: height * 0.02,
    flexGrow: 1,
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: width < 400 ? "48%" : "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: width * 0.06,
    paddingVertical: height * 0.02,
    marginBottom: height * 0.02,
    alignItems: "center",
    justifyContent: "center",
    minHeight: scale(160),
    elevation: 3,
    shadowColor: factoryColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconBox: {
    width: isSmallDevice ? 120 : 140,
    height: isSmallDevice ? 120 : 140,
    borderRadius: 24,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    elevation: 30, 
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  menuIcon: {
    width: isSmallDevice ? scale(90) : scale(120),
    height: isSmallDevice ? scale(90) : scale(120),
  },
  cardText: {
    fontSize: isSmallDevice ? scale(16) : scale(18),
    fontWeight: "900",
    textAlign: "center",
    lineHeight: isSmallDevice ? scale(18) : scale(22),
    color: "#1E293B",
  },
  activeDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4F46E5",
  },
  loadingOverlay: {
    position: "absolute",
    top: scale(56),
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    zIndex: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: scale(14),
    fontWeight: "600",
    color: factoryColor,
  },
  emptyContainer: {
    width: "100%",
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  footerButton: {
    flex: 1,
    height: scale(38),
    backgroundColor: factoryColor,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  footerButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  disabledFooterButton: {
    backgroundColor: "#CBD5E1",
    elevation: 0,
    shadowOpacity: 0,
  },
  disabledFooterButtonText: {
    color: "#94A3B8",
  },
  footerIcon: {
    width: scale(30),
    height: scale(30),
    tintColor: "#FFFFFF",
  },
  disabledFooterIcon: {
    tintColor: "#94A3B8",
  },
  exitNavButton: {
    backgroundColor: "#EF4444",
  },
  exitNavButtonText: {
    color: "#FFFFFF",
  },
});