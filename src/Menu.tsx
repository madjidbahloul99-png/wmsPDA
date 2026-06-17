import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobal } from "../GlobalContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
const { width } = Dimensions.get("window");

const menuItems = [
  { title: "Warehousing\nScanning", icon: require("../assets/logomenu/Inwarehouse.png"), screen: "InWarehouse", fcode: "button_in" },
  { title: "Allocate Into\nWarehouse", icon: require("../assets/logomenu/AllocateIn.png"), screen: "AllocateInNO", fcode: "button_DBIn" },
  { title: "Allocate Out", icon: require("../assets/logomenu/Allocateout.png"), screen: "AllocateSAP", fcode: "button_DBOutSAP" },
  { title: "Delivery", icon: require("../assets/logomenu/Delivery.png"), screen: "DeliverySAP", fcode: "button_fahuoSAP" },
  { title: "Allocate Return\nInto WH", icon: require("../assets/logomenu/reject.png"), screen: "AllocateRejectIn", fcode: "btnAllocateRejectIn" },
  { title: "Delivery\nReturn", icon: require("../assets/logomenu/DeliveryReturn.png"), screen: "DeliveryReturnNo", fcode: "btnDeliveryReturn" },
  { title: "Inventory\nVerification", icon: require("../assets/logomenu/inventory1.png"), screen: "PD", fcode: "button_pd" },
  { title: "Pallet\nSearch", icon: require("../assets/logomenu/searchpallet.png"), screen: "PalletSearch", fcode: "button_pallerCx" },
  { title: "Not In\nWare", icon: require("../assets/logomenu/Notinware.png"), screen: "PalletNotIn", fcode: "btnNotIn" },
  { title: "Box/Pallet\nAssembly", icon: require("../assets/logomenu/Assembly.png"), screen: "Assembly", fcode: "button_boxZu" },
  { title: "Box/Pallet\nDisassembly", icon: require("../assets/logomenu/Disassembly.png"), screen: "Disassembly", fcode: "button_boxChai" },
  { title: "SN\nReturn", icon: require("../assets/logomenu/SNReturn.png"), screen: "SNReturn", fcode: "btnReturnSN" },
  { title: "Distributor\nReturn", icon: require("../assets/logomenu/DistributorReturn.png"), screen: "DistributorReturnNo", fcode: "btnDistributeReturn" },
  /*{ title: "Allocate Out\nWarehouse", icon: "🚚", screen: "/", fcode: "button_DBOut" },
 { title: "Warehouse\nDelivery", icon: "📦", screen: "/", fcode: "button_fahuo" },
 */
];

export default function Menu({ navigation }: any) {
  const { gsURL, setgs_gsURL, gs_userName, gs_wareCode, gs_wareName } = useGlobal();
  const BASE_URL = gsURL;
  const [token, setToken] = useState("");

  const { gs_roleCode } = useGlobal();
  const { gs_wareType, operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion, } = useGlobal();
  const [allowedMenus, setAllowedMenus] = useState<string[]>([]);




  useEffect(() => {
    const loadToken = async () => {
      const t = await AsyncStorage.getItem("userToken");
      console.log("TOKEN IN MENU:", t);
      if (t) setToken(t);
      console.log("Operateinfo:", operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion);
    };

    loadToken();
  }, []);

  useEffect(() => {
    if (!token) return;

    const loadMenuByRole = async () => {

      try {
        const res = await fetch(
          `${BASE_URL}/api/MenuListByRolePDA/pbc_MenuListByRolePDA`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
              roleCode: gs_roleCode,
            }),
          }
        );

        if (res.status === 401) {
          Alert.alert("Unauthorized", "Token expired or invalid.");
          return;
        }

        if (res.status === 403) {
          Alert.alert("Access Denied", "You do not have permission.");
          return;
        }

        console.log("STATUS:", res.status);

        if (!res.ok) {
          const errorText = await res.text();
          console.log("ERROR:", errorText);

          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (data.Code === 500) {
          Alert.alert("Error", data.Message);
          return;
        }

        console.log("MENU RESPONSE:", data);

        if (data.code === 200 && data.data) {
          const codes = data.data.map((m: any) => m.fcode);
          setAllowedMenus(codes);
        }
      } catch (error) {
        console.log(error);
        Alert.alert("Error", "Unable to load menu");
      }
    };

    loadMenuByRole();
  }, [token]);


  const handleNavigation = (item: any) => {
    if (
      item.screen === "WarehousingScanning" &&
      gs_wareType !== "MainWarehouse"

    ) {
      Alert.alert(
        "Restricted Access",
        "Only the main warehouse can be put in storage!",
        [
          {
            text: "OK",
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
      return;
    }

    if (item.screen) {
      navigation.navigate(item.screen);
    } else {
      Alert.alert(
        "Restricted Access",
        "This module is currently undergoing maintenance."
      );
    }
  };

  const handleReturn = () => {
    navigation.goBack();

  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Exit",
          style: "destructive",
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: "Login" }],
            });
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

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

      <View style={styles.subHeader}>
        <View style={styles.subHeaderItem}>
          <Image
            source={require("../assets/logo/user.png")}
            style={styles.subHeaderIcon}
            resizeMode="contain"
          />
          <Text style={styles.subHeaderText}>{gs_userName}</Text>
        </View>
        <View style={styles.subHeaderItem}>
          <Image
            source={require("../assets/logo/warehouse.png")}
            style={styles.subHeaderIcon}
            resizeMode="contain"
          />
          <Text style={styles.subHeaderText}>{gs_wareName}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >


        <View style={styles.grid}>
          {menuItems.map((item, index) => {
            const isEnabled = item.fcode ? allowedMenus.includes(item.fcode) : false;
            //const isEnabled = true;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.card, !isEnabled && styles.disabledCard]}
                activeOpacity={0.7}
                disabled={!isEnabled}
                onPress={() => item.screen && handleNavigation(item)}
              >
                <View style={[styles.iconBox, !isEnabled && styles.disabledIconBox]}>
                  <Image source={item.icon} style={styles.menuIcon} resizeMode="contain" />
                </View>

                <Text style={[styles.cardText, !isEnabled && styles.disabledText]}>
                  {item.title}
                </Text>

                {isEnabled && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
        </View>


      </ScrollView>
    </SafeAreaView>
  );
}


const { height } = Dimensions.get("window");
const isSmallDevice = width < 360;
const scale = (size: number) => (width / 375) * size;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  header: {
    backgroundColor: "#0052cc",
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

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },

  userNameText: {
    color: "#FFFFFF",
    fontSize: scale(12),
    fontWeight: "700",
    marginRight: 1,
  },

  subHeader: {
    flexDirection: 'row',
    backgroundColor: '#0052cc',
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

  logoutButton: {
    width: isSmallDevice ? 36 : 44,
    height: isSmallDevice ? 36 : 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },

  logoutIcon: {
    width: "60%",
    height: "60%",
    tintColor: "#FFFFFF",
  },

  scrollContainer: {
    paddingHorizontal: width * 0.03,
    paddingTop: height * 0.01,
    paddingBottom: height * 0.02,
    flexGrow: 1,
    justifyContent: "center",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: height * 0.02,
  },

  sectionIndicator: {
    width: 4,
    height: 16,
    backgroundColor: "#4F46E5",
    borderRadius: 2,
    marginRight: 8,
  },

  sectionTitle: {
    fontSize: isSmallDevice ? scale(10) : scale(12),
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
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

  },

  disabledCard: {
    opacity: 0.5,
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },

  disabledIconBox: {
    opacity: 0.3,
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

  disabledText: {
    color: "#94A3B8",
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

  exitButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: height * 0.025,
    borderRadius: 20,
    marginTop: height * 0.03,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FEE2E2",
  },

  exitText: {
    color: "#EF4444",
    fontSize: isSmallDevice ? scale(11) : scale(13),
    fontWeight: "900",
  },

  footerInfo: {
    marginTop: height * 0.04,
    alignItems: "center",
  },

  footerText: {
    color: "#94A3B8",
    fontSize: isSmallDevice ? scale(8) : scale(10),
  },
});
