import React, { useState, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as soapClient from "./soapClient";

interface SNItem {
  id: string;
  fxh: string;
  sn: string;
  imei1: string;
  imei2: string;
  imei3: string;
  realdate: string;
  orderCode: string;
}

export default function InWarehouseSNConfirm({ navigation, route }: any) {
  const { palletCode, boxCode, f_showConfirm } = route.params || {};
  const {
    gs_MESBaseURL,
    gs_factoryCodeMES,
    gs_wareType,
    gs_userName,
    gs_userCode,
  } = useGlobalStr();

  const [loading, setLoading] = useState(true);
  const [dataList, setDataList] = useState<SNItem[]>([]);
  const [titleAddon, setTitleAddon] = useState("");

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const data = await soapClient.InPalletSNConfirm(
        gs_MESBaseURL,
        gs_factoryCodeMES || "001",
        palletCode,
        boxCode
      );

      if (data && data.length > 0) {
        if (data[0].isok === "0") {
          pubfunction.ShowError(data[0].retstr || "There is no product in the Pallet!");
          setDataList([]);
          return;
        }

        const productRows = data.filter((item: any) => item.SN || item.boxCode || item.scanBarcodeLarge);

        if (productRows.length > 0) {
          const first = productRows[0];
          setTitleAddon(` ${first.model || ""} ${first.color || ""}`);

          const mapped = productRows.map((item: any, index: number) => ({
            id: index.toString(),
            fxh: item.fxh || String(index + 1),
            sn: item.SN || "",
            imei1: item.imeiCode1 || "",
            imei2: item.imeiCode2 || "",
            imei3: item.imeiCode3 || "",
            realdate: item.realdate || "",
            orderCode: item.orderCode || "",
          }));
          setDataList(mapped);
        } else {
          pubfunction.ShowError("There is no product in the Pallet!");
          setDataList([]);
        }
      } else {
        pubfunction.ShowError("There is no product in the Pallet!");
        setDataList([]);
      }
    } catch (err: any) {
      pubfunction.ShowError("Fetch details failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gs_wareType !== "MainWarehouse") {
      pubfunction.ShowError("Only the main warehouse can be put in storage!");
      navigation.goBack();
      return;
    }
    fetchDetails();
  }, [palletCode, boxCode]);

  const handleReturn = () => {
    navigation.goBack();
  };

  const handleConfirm = () => {
    navigation.navigate("InWarehouseConfirmBox", { confirmed: true });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleReturn} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            SN Details
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Pallet Code Box */}
        <View style={styles.totalQtyBox}>
          <Text style={styles.totalQtyLabel}>Pallet:</Text>
          <Text style={styles.totalQtyValue}>{palletCode}</Text>
        </View>

        {/* Box Code Box */}
        <View style={styles.totalQtyBox}>
          <Text style={styles.totalQtyLabel}>Box:</Text>
          <Text style={styles.totalQtyValue}>{boxCode}</Text>
        </View>

        {/* Total Qty Box */}
        <View style={styles.totalQtyBox}>
          <Text style={styles.totalQtyLabel}>Total Qty:</Text>
          <Text style={styles.totalQtyValue}>{dataList.length}</Text>
        </View>

        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 50 }]}>Index</Text>
                <Text style={[styles.headerCell, { width: 130 }]}>SN</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>IMEI 1</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>IMEI 2</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>IMEI 3</Text>
                <Text style={[styles.headerCell, { width: 180 }]}>Scan Date</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>Order</Text>
              </View>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true}>
                {loading ? (
                  <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                ) : dataList.length === 0 ? (
                  <Text style={styles.emptyText}>No SN items found inside this box.</Text>
                ) : (
                  dataList.map((item, index) => (
                    <View
                      key={item.id || index}
                      style={[
                        styles.tableRow,
                        index % 2 === 0 ? { backgroundColor: "#FFFFFF" } : { backgroundColor: "#F1F5F9" }
                      ]}
                    >
                      <Text style={[styles.cell, { width: 50 }]}>{item.fxh}</Text>
                      <Text style={[styles.cell, { width: 130 }]}>{item.sn}</Text>
                      <Text style={[styles.cell, { width: 120 }]}>{item.imei1}</Text>
                      <Text style={[styles.cell, { width: 120 }]}>{item.imei2}</Text>
                      <Text style={[styles.cell, { width: 120 }]}>{item.imei3}</Text>
                      <Text style={[styles.cell, { width: 180 }]}>{item.realdate}</Text>
                      <Text style={[styles.cell, { width: 100 }]}>{item.orderCode}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </View>

        {/* Bottom Nav */}
        {f_showConfirm && (
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.btn, styles.btnConfirm]} onPress={handleConfirm}>
              <Text style={styles.btnText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");
const scale = (size: number) => (width / 375) * size;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    backgroundColor: "#0052cc",
    paddingHorizontal: width * 0.05,
    height: scale(56),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 4,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center" },
  returnLogo: { width: scale(23), height: scale(23), marginRight: 10, tintColor: "#FFFFFF" },
  headerTitle: { color: "#FFFFFF", fontSize: scale(11), fontWeight: "900", flex: 1 },
  userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
  totalQtyBox: { backgroundColor: "#0052cc", padding: 12, borderRadius: 8, flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  totalQtyLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  totalQtyValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  content: { flex: 1, padding: 16 },
  tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden", elevation: 3, borderWidth: 1, borderColor: "#0052cc", marginBottom: 12 },
  tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
  headerCell: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", alignItems: "center" },
  cell: { fontSize: 11, color: "#1E293B", textAlign: "center", fontWeight: "600" },
  emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 400 },
  footer: { flexDirection: "row", borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12 },
  btn: { flex: 1, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4, elevation: 1 },
  btnConfirm: { backgroundColor: '#10B981' },
  btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
