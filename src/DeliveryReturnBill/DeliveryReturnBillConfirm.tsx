import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
  DeviceEventEmitter,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import { ApiContext, confirmReturn } from "./api";
import { ReturnContext, TraceabilityRecord } from "./types";
import { EVENT_REFRESH, EVENT_RETURNED } from "./events";

/**
 * Page 4 - Confirm the return of a product that has a delivery traceability.
 *
 * Shows the product information and the traceability details, the operator
 * confirms the return, the product is added back to the stock, the processed
 * quantity and the product status are updated and the operator can continue
 * with the next product.
 */
export default function DeliveryReturnBillConfirm({ navigation, route }: any) {
  const params: ReturnContext & { f_sn?: string; f_trace?: TraceabilityRecord } =
    route.params || {};

  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
    gs_classCode,
    gs_IPAddress,
  } = useGlobalStr();

  const apiCtx: ApiContext = {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
    gs_classCode,
    gs_IPAddress,
  };

  const [loading, setLoading] = useState(false);
  const [labelError, setLabelError] = useState("");

  const trace: TraceabilityRecord = params.f_trace || {
    sn: params.f_sn || "",
    model: params.f_model || "",
    color: params.f_color || "",
    palletCode: "",
    boxCode: "",
    imei1: "",
    imei2: "",
    imei3: "",
    deliveryDate: "",
    ean: "",
    productStatus: "",
    warehouseCode: params.f_wareCode || "",
    customerCode: params.f_customerCode || "",
  };

  /**
   * Confirms the return of the product.
   */
  const handleConfirmClick = async () => {
    setLoading(true);
    setLabelError("");

    try {
      const result = await confirmReturn(apiCtx, {
        context: params,
        sn: params.f_sn || "",
        trace: trace,
      });

      if (!result.success) {
        setLabelError(result.msg || "Save barcode error");
        return;
      }

      // Refresh the processed quantity and the status on the SN page
      DeviceEventEmitter.emit(EVENT_RETURNED, {
        actualQty: result.actualQty,
        planQty: result.planQty,
        productStatus: result.productStatus,
      });

      // Back to the SN scan page for the next product
      navigation.goBack();
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network error");
      setLabelError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleExitClick = () => {
    DeviceEventEmitter.emit(EVENT_REFRESH);
    navigation.goBack();
  };

  const infoRow = (label: string, value: string) => (
    <View style={styles.infoRowItem}>
      <Text style={styles.infoLabelWhite}>{label}</Text>
      <Text style={styles.infoValueWhite}>{value || "-"}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleExitClick} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery Return Confirm</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Product information */}
        <View style={styles.infoCardWrapper}>
          {infoRow("Bill Code", params.f_systemDeliveryCode)}
          {infoRow("SAP Bill", params.f_sapMainBillCode)}
          {infoRow("Model", params.f_model)}
          {infoRow("Color", params.f_color)}
          {infoRow("SN", params.f_sn || trace.sn)}
          {infoRow("Batch", params.f_operatorBatch)}
          {infoRow("Supplier", params.f_customerCode)}
          {infoRow("Warehouse", params.f_wareCode || gs_wareCode)}
          {infoRow("Qty", `${params.f_doneQty || 0}/${params.f_planQty || 0}`)}
        </View>

        {/* Traceability details */}
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 120 }]}>SN</Text>
                <Text style={[styles.headerCell, { width: 110 }]}>Pallet</Text>
                <Text style={[styles.headerCell, { width: 110 }]}>Box</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>IMEI 1</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>IMEI 2</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>IMEI 3</Text>
                <Text style={[styles.headerCell, { width: 130 }]}>Delivery Date</Text>
                <Text style={[styles.headerCell, { width: 130 }]}>EAN</Text>
                <Text style={[styles.headerCell, { width: 110 }]}>Status</Text>
              </View>

              <View style={styles.tableRow}>
                <Text style={[styles.cell, { width: 120 }]}>
                  {trace.sn || params.f_sn || "-"}
                </Text>
                <Text style={[styles.cell, { width: 110 }]}>
                  {trace.palletCode || "-"}
                </Text>
                <Text style={[styles.cell, { width: 110 }]}>
                  {trace.boxCode || "-"}
                </Text>
                <Text style={[styles.cell, { width: 140 }]}>
                  {trace.imei1 || "-"}
                </Text>
                <Text style={[styles.cell, { width: 140 }]}>
                  {trace.imei2 || "-"}
                </Text>
                <Text style={[styles.cell, { width: 140 }]}>
                  {trace.imei3 || "-"}
                </Text>
                <Text style={[styles.cell, { width: 130 }]}>
                  {trace.deliveryDate || "-"}
                </Text>
                <Text style={[styles.cell, { width: 130 }]}>
                  {trace.ean || "-"}
                </Text>
                <Text style={[styles.cell, { width: 110 }]}>
                  {trace.productStatus || "-"}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>

        {labelError ? <Text style={styles.infoText}>{labelError}</Text> : null}

        {/* Footer actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, styles.exitBtn]}
            onPress={handleExitClick}
          >
            <Text style={styles.btnText}>Exit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.confirmBtn]}
            onPress={handleConfirmClick}
          >
            <Text style={styles.btnText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0052cc" />
        </View>
      )}
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
  headerLeft: { flexDirection: "row", alignItems: "center" },
  returnLogo: { width: scale(24), height: scale(24), marginRight: 10, tintColor: "#FFFFFF" },
  headerTitle: { color: "#FFFFFF", fontSize: scale(14), fontWeight: "900" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
  content: { flex: 1, padding: 8 },
  infoCardWrapper: {
    backgroundColor: "#FFFFFF",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 8,
  },
  infoRowItem: {
    backgroundColor: "#0052cc",
    padding: 9,
    borderRadius: 8,
    marginBottom: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabelWhite: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  infoValueWhite: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  tableCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 8,
  },
  tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
  headerCell: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  cell: { fontSize: 11, color: "#1E293B", textAlign: "center", fontWeight: "600" },
  infoText: { color: "#EF4444", fontSize: 13, marginTop: 4, marginLeft: 4, fontWeight: "800" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 6,
  },
  btn: {
    flex: 1,
    height: 45,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
  },
  exitBtn: { backgroundColor: "#64748B" },
  confirmBtn: { backgroundColor: "#0052cc" },
  btnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});
